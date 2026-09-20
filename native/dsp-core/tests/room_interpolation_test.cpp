/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "../src/room_internal.h"
#include "../src/room_interpolation.h"
#include "../../system-apo/src/room_head.h"
#include "dsp_test_support.h"
#include <algorithm>
#include <cmath>
#include <complex>
#include <fstream>
#include <iterator>
#include <limits>
#include <string>
// Sweeps contain thousands of assertions; emit failures and a final count.
int checks = 0;
void check(bool condition, const char* message) {
  ++checks;
  if (!condition) feq_test::check(false, message);
}
using feq_test::kPi;
namespace {
using Buffer = std::vector<float>;
double energy(const Buffer& b) { double e=0; for(float v:b) e+=double(v)*v; return e; }
double difference(const Buffer& a,const Buffer& b) {
  double d=0; for(size_t i=0;i<std::max(a.size(),b.size());++i) {
    const double x=(i<a.size()?a[i]:0)-(i<b.size()?b[i]:0); d+=x*x;
  } return std::sqrt(d);
}
std::complex<double> spectrum(const Buffer& b,double hz,double rate) {
  std::complex<double> sum{}; for(size_t i=0;i<b.size();++i)
    sum+=double(b[i])*std::polar(1.0,-2*kPi*hz*double(i)/rate);
  return sum;
}
double centroid(const Buffer& b) {
  double n=0; for(size_t i=0;i<b.size();++i) n+=double(i)*b[i]*b[i];
  return n/energy(b);
}
void synthetic(FeqRoom& r,double rate) {
  r.sample_rate=rate;r.directions=24;r.taps=512;r.doubling=rate==192000;
  r.head_left.assign(r.directions*r.taps,0);r.head_right=r.head_left;
  const double native_rate=r.doubling?rate/2:rate;
  for(uint32_t d=0;d<24;++d) {
    const double sine=std::sin(double(d)*kPi/12);
    const int delay=int(std::lround(0.0004*native_rate*sine));
    const int origin=int(std::lround(0.001*native_rate));
    r.head_left[size_t(d)*r.taps+size_t(origin+delay)]=float(0.8-0.2*sine);
    r.head_right[size_t(d)*r.taps+size_t(origin-delay)]=float(0.8+0.2*sine);
  }
}
void direction_tests(double rate) {
  FeqRoom r;synthetic(r,rate);RoomInterpolation interp(&r);
  Buffer a,b,m,left,right;
  for(int ear=0;ear<2;++ear) for(int d=0;d<24;++d) {
    interp.response(d*15.0,ear,0,a);interp.response((d+1)*15.0,ear,0,b);
    interp.response(d*15.0+7.5,ear,0,m);
    const double expected=(centroid(a)+centroid(b))/2;
    check(std::fabs(centroid(m)-expected)<0.3,"synthetic midpoint timing follows known endpoints");
    const double dc=(std::abs(spectrum(a,0,rate))+std::abs(spectrum(b,0,rate)))/2;
    check(std::fabs(std::abs(spectrum(m,0,rate))-dc)<0.002,"synthetic gain follows endpoints");
    // Independent delay-only input has no physical comb filter to reproduce.
    for(double hz:{1000.,4000.,8000.,12000.,16000.}) {
      const double expected_mag=(std::abs(spectrum(a,hz,rate))+std::abs(spectrum(b,hz,rate)))/2;
      check(std::abs(spectrum(m,hz,rate))>expected_mag*0.97,"no delay-induced audible comb notches");
    }
    // Constant physical sub-sample displacement: an identical angular step
    // moves four times as many samples at 192k as at 48k.
    const double epsilon = 0.001 * 48000.0 / rate;
    interp.response(d*15.0-epsilon,ear,0,a);interp.response(d*15.0+epsilon,ear,0,b);
    check(difference(a,b)<0.002,"continuous across every cell boundary including seam");
  }
  for(double angle=-180;angle<=360;angle+=0.25) {
    interp.response(angle,0,0,left);interp.response(-angle,1,0,right);
    check(difference(left,right)<0.00001,"mirrored head remains symmetric");
    check(std::isfinite(energy(left))&&energy(left)>0.1&&energy(left)<2,"fine sweep bounded positive energy");
  }
  interp.response(7.5,0,0,a);
  for(double angle:{367.5,-352.5,360000007.5}) {
    interp.response(angle,0,0,b);check(difference(a,b)<1e-6,"large finite and negative angles wrap");
  }
  interp.response(-180,0,0,a);interp.response(180,0,0,b);check(a==b,"180 seam same response");
  interp.response(0,0,0,a);interp.response(std::numeric_limits<double>::quiet_NaN(),0,0,b);
  check(a==b,"helper nonfinite angle repaired before indexing");
  std::printf("synthetic %.0f Hz passed directional sweep\n",rate);
}
Buffer impulse(FeqRoom* r,int ear,int channel=0) {
  Buffer left(4096),right(4096);(channel==0?left:right)[0]=1;
  for(size_t at=0;at<left.size();at+=128) {
    float* p[]={left.data()+at,right.data()+at};feq_room_process(r,p,128);
  } return ear==0?left:right;
}
FeqRoom* setup(const FeqRoom& data,int version,double angle,bool low) {
  FeqRoom* r=feq_room_create(data.sample_rate,2,128);
  int layout[]={0,1};feq_room_set_layout(r,layout,-1);
  feq_room_set_head(r,data.head_left.data(),data.head_right.data(),data.directions,data.taps,data.doubling);
  feq_room_set_low_latency(r,low?1:0);
  FeqRoomSettings s;feq_room_settings_defaults(&s);s.enabled=1;s.walls=1;s.bass_management=0;
  s.renderer_version=version;s.angle_deg[0]=angle;feq_room_configure(r,&s);feq_room_reset(r);return r;
}
void processing_tests(double rate,bool low) {
  FeqRoom data;synthetic(data,rate);
  for(double angle:{0.,15.,90.,180.,345.}) {
    FeqRoom* v1=setup(data,1,angle,low);FeqRoom* v2=setup(data,2,angle,low);
    check(impulse(v1,0)==impulse(v2,0),"exact grid pipeline samples equal legacy");
    check(feq_room_latency_frames(v1)==feq_room_latency_frames(v2),"v2 adds no pipeline delay");
    feq_room_destroy(v1);feq_room_destroy(v2);
  }
  FeqRoom* old=setup(data,1,4,low);FeqRoom* grid=setup(data,1,0,low);
  check(impulse(old,0)==impulse(grid,0),"v1 retains nearest direction");feq_room_destroy(old);feq_room_destroy(grid);
  FeqRoom* r=setup(data,2,7.5,low);RoomInterpolation interp(&data);Buffer expected;
  interp.response(7.5,0,0,expected);const Buffer actual=impulse(r,0);
  const size_t latency=feq_room_latency_frames(r);Buffer shifted(actual.size());
  std::copy(expected.begin(),expected.end(),shifted.begin()+latency);
  check(difference(actual,shifted)<1e-5,"rendered midpoint has prepared timing and no hidden delay");
  feq_room_destroy(r); r=setup(data,2,7.5,low);
  auto scaled = r->settings; scaled.head_scale = 1.07;
  feq_room_configure(r, &scaled); feq_room_reset(r);
  const double extra = 0.07 * 0.00065 * std::sin(7.5*kPi/180) * rate;
  interp.response(7.5,0,extra,expected);std::fill(shifted.begin(),shifted.end(),0.0f);
  std::copy(expected.begin(),expected.end(),shifted.begin()+latency);
  check(difference(impulse(r,0),shifted)<1e-5,"head scale preserves fractional ear timing");
  // LFE alignment uses the existing sub low pass; onset is the reported latency.
  int layout[]={0,-1};feq_room_set_layout(r,layout,1);feq_room_reset(r);
  const Buffer sub=impulse(r,0,1);size_t first=0;while(first<sub.size()&&std::fabs(sub[first])<1e-7)++first;
  check(first==latency,"sub bus retains reported alignment");
  feq_room_destroy(r);
}
void real_heads() {
  for(const char* name:{"small","medium","large"}) for(double rate:{44100.,48000.,96000.,192000.}) {
    std::ifstream file(std::string(FEQ_ROOM_HEAD_DIR)+"/"+name+".txt");
    const std::string text((std::istreambuf_iterator<char>(file)),{});
    const auto head=fluideq_engine::parse_room_head(text,rate);check(head.has_value(),"shipped head loads");if(!head)continue;
    FeqRoom r;r.sample_rate=rate;r.directions=head->directions;r.taps=head->taps;
    r.doubling=head->needs_doubling;r.head_left=head->left;r.head_right=head->right;RoomInterpolation interp(&r);
    double min_energy=10,max_energy=0,worst_seam=0,min_tone=100,max_tone=-100,max_itd=0;
    double worst_angle=0,worst_hz=0,worst_a=0,worst_b=0,worst_m=0,max_negative=0,min_band=100,max_band=-100;
    int worst_ear=0;
    for(int d=0;d<24;++d) {
      double times[2][3]{};
      for(int ear=0;ear<2;++ear) {
        Buffer a,b,m,pre,post;interp.response(d*15.,ear,0,a);interp.response((d+1)*15.,ear,0,b);
        const auto& source = ear==0 ? head->left : head->right;
        bool exact=true;
        for(uint32_t tap=0;tap<head->taps;++tap) {
          const float value=source[size_t(d)*head->taps+tap];
          if(!head->needs_doubling) exact=exact&&a[tap]==value;
          else {
            // Doubled AND halved: twice the taps at the same height was twice
            // the gain, 6 dB louder at 192 kHz (`head_response`).
            const float next=tap+1<head->taps?source[size_t(d)*head->taps+tap+1]:0;
            exact=exact&&a[2*tap]==0.5f*value&&a[2*tap+1]==0.25f*(value+next);
          }
        }
        check(exact,"real exact directions retain every original measurement sample");
        RoomInterpolationMetrics metrics;
        interp.response(d*15.+7.5,ear,0,m,&metrics);
        max_negative=std::max(max_negative,metrics.negative_energy /
          (metrics.negative_energy+metrics.late_energy+metrics.retained_energy));
        const double ratio=energy(m)/((energy(a)+energy(b))/2);min_energy=std::min(min_energy,ratio);max_energy=std::max(max_energy,ratio);
        check(std::isfinite(ratio)&&ratio>0.85&&ratio<1.1,"real midpoint energy bounded relative to source measurements");
        interp.response(d*15.-0.001,ear,0,pre);interp.response(d*15.+0.001,ear,0,post);
        const double jump=difference(pre,post)/std::sqrt(energy(a));worst_seam=std::max(worst_seam,jump);
        check(jump<0.004,"real direction boundary continuity");
        for(double hz:{250.,1000.,4000.,8000.,12000.,16000.}) {
          const double reference=0.5*(std::abs(spectrum(a,hz,rate))+std::abs(spectrum(b,hz,rate)));
          const double tone=20*std::log10(std::max(1e-12,std::abs(spectrum(m,hz,rate)))/std::max(1e-12,reference));
          if(tone<min_tone) {
            min_tone=tone;worst_angle=d*15.+7.5;worst_ear=ear;worst_hz=hz;
            worst_a=std::abs(spectrum(a,hz,rate));worst_b=std::abs(spectrum(b,hz,rate));worst_m=std::abs(spectrum(m,hz,rate));
          }
          max_tone=std::max(max_tone,tone);
          double source_power=0,mid_power=0;
          for(int band=-3;band<=3;++band) {
            const double f=hz*std::pow(2.0,double(band)/18.0);
            const double reference_mag=(std::abs(spectrum(a,f,rate))+std::abs(spectrum(b,f,rate)))/2;
            source_power+=reference_mag*reference_mag;mid_power+=std::norm(spectrum(m,f,rate));
          }
          const double band_db=10*std::log10(mid_power/source_power);
          min_band=std::min(min_band,band_db);max_band=std::max(max_band,band_db);
          check(band_db>-3&&band_db<3,"real one-third-octave tone stays within 3dB of endpoint magnitude mean");
        }
        times[ear][0]=centroid(a);times[ear][1]=centroid(b);times[ear][2]=centroid(m);
      }
      const double target=((times[0][0]-times[1][0])+(times[0][1]-times[1][1]))/2;
      max_itd=std::max(max_itd,std::fabs(times[0][2]-times[1][2]-target)/rate*1e6);
    }
    std::printf("real %s %.0f: energy %.5f..%.5f, tone dB %.3f..%.3f, boundary %.7f, centroid ITD deviation %.3f us\n",name,rate,min_energy,max_energy,min_tone,max_tone,worst_seam,max_itd);
    check(max_itd<100,"real centroid ITD deviation remains below 100us");
    std::printf("  worst %.1f deg ear %d %.0f Hz endpoints %.6f/%.6f midpoint %.6f; band dB %.3f..%.3f; negative energy %.4f%%\n",
      worst_angle,worst_ear,worst_hz,worst_a,worst_b,worst_m,min_band,max_band,max_negative*100);
  }
}
void zero_bin_phase_limits() {
  for (bool silent : {true, false}) {
    FeqRoom data;
    data.sample_rate = 48000;
    data.directions = 2;
    data.taps = 256;
    data.head_left.assign(512, 0.0f);
    if (!silent) {
      // Equal taps two samples apart have exact spectral zeros at fs/4.
      data.head_left[48] = 1.0f;
      data.head_left[50] = 1.0f;
    }
    // A nontrivial phase response: magnitude alone cannot reconstruct it.
    data.head_left[256 + 64] = 1.0f;
    data.head_left[256 + 65] = 0.35f;
    data.head_left[256 + 70] = -0.2f;
    data.head_right = data.head_left;
    RoomInterpolation interpolation(&data);
    Buffer endpoint, from_left, from_right, middle;
    interpolation.response(180, 0, 0, endpoint);
    interpolation.response(180 - 1e-6, 0, 0, from_left);
    interpolation.response(180 + 1e-6, 0, 0, from_right);
    interpolation.response(90, 0, 0, middle);
    const double norm = std::sqrt(energy(endpoint));
    const double left_error = difference(endpoint, from_left) / norm;
    const double right_error = difference(endpoint, from_right) / norm;
    check(left_error < 1e-5, "zero-bin neighbor preserves the nonzero endpoint's phase limit");
    check(right_error < 1e-5, "zero-bin limit remains continuous from the reverse direction");
    check(energy(middle) > 0.1 && std::isfinite(energy(middle)),
          "zero-bin interpolation retains a meaningful finite response");
    // The isolated-zero bin has a nonzero, complex endpoint response.
    if (!silent) {
      const auto target = spectrum(endpoint, 12000, 48000);
      check(std::abs(target) > 0.5 && std::fabs(target.imag()) > 0.1,
            "isolated-zero regression has a nontrivial endpoint phase");
      check(std::abs(spectrum(from_left, 12000, 48000) - target) < 1e-5,
            "isolated spectral zero retains the neighboring endpoint's complex response");
    }
    std::printf("zero-bin silent=%d endpoint errors %.9g / %.9g\n",
                silent ? 1 : 0, left_error, right_error);
  }
}
void invalid_inputs() {
  check(feq_room_create(std::numeric_limits<double>::infinity(),2,128)==nullptr,"infinite rate refused");
  FeqRoom data;synthetic(data,48000);FeqRoom* r=setup(data,2,7.5,false);
  const auto before=r->head_left;float sample=1;
  feq_room_set_head(r,&sample,&sample,UINT32_MAX,UINT32_MAX,0);check(r->head_left==before,"oversized head refused before input read");
  sample=std::numeric_limits<float>::infinity();feq_room_set_head(r,&sample,&sample,1,1,0);check(r->head_left==before,"nonfinite head refused");
  const auto good=r->settings;auto bad=good;bad.angle_deg[0]=std::numeric_limits<double>::quiet_NaN();feq_room_configure(r,&bad);
  check(r->settings.angle_deg[0]==good.angle_deg[0],"nonfinite angle refused");
  bad=good;bad.distance_m=std::numeric_limits<double>::max();feq_room_configure(r,&bad);check(r->settings.distance_m==good.distance_m,"unbounded path refused");
  bad=good;bad.renderer_version=99;feq_room_configure(r,&bad);check(r->settings.renderer_version==1,"unknown renderer normalizes to legacy");
  feq_room_destroy(r);
}
void reconfiguration(bool low) {
  FeqRoom data;synthetic(data,48000);FeqRoom* moving=setup(data,2,12,low);
  FeqRoom* control=setup(data,2,12,low);double worst=0,max_transfer=0,transfer_error=0;float last=0;
  for(int block=0;block<240;++block) {
    if(block==80) {auto s=moving->settings;s.angle_deg[0]=18;feq_room_configure(moving,&s);feq_room_configure(control,&s);}
    if(block==160) {
      FeqRoom* next=setup(data,2,18,low);feq_room_transfer(next,moving);feq_room_destroy(moving);moving=next;
    }
    Buffer l(128),r(128),cl(128),cr(128);
    for(int i=0;i<128;++i) l[size_t(i)]=cl[size_t(i)]=float(0.2*std::sin(2*kPi*440*(block*128+i)/48000));
    float* p[]={l.data(),r.data()};float* cp[]={cl.data(),cr.data()};feq_room_process(moving,p,128);feq_room_process(control,cp,128);
    for(float v:l) {if(block>50)worst=std::max(worst,double(std::fabs(v-last)));last=v;}
    if(block>=160&&block<170) for(size_t i=0;i<l.size();++i) {
      max_transfer=std::max(max_transfer,double(std::fabs(l[i])));
      transfer_error=std::max(transfer_error,double(std::fabs(l[i]-cl[i])));
    }
  }
  check(worst<0.02,"angle change and compatible transfer remain smooth on 440Hz signal");
  check(transfer_error<1e-6,"compatible transfer matches uninterrupted reference");
  check(max_transfer>0.1,"transfer retains meaningful nonzero signal");
  std::printf("reconfigure low=%d worst step %.6f transfer peak %.6f\n",low?1:0,worst,max_transfer);
  feq_room_destroy(moving);feq_room_destroy(control);
}
}
int main() {
  for(double rate:{44100.,48000.,96000.,192000.}) {direction_tests(rate);for(bool low:{false,true})processing_tests(rate,low);}
  zero_bin_phase_limits();real_heads();invalid_inputs();reconfiguration(false);reconfiguration(true);
  std::printf("%d assertions\n",checks);return feq_test::finish();
}
