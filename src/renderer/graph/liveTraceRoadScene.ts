/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { type RefObject } from 'react';
import { setAlpha } from './liveTraceStyle';
import { type createRoadTripPaths, RoadLane } from './roadTrip';

// The road trip on the live graph: the road as a line or as a filled
// landscape, and what is drawn over each.

interface IPaintRoadLineInput {
  roadPaths: ReturnType<typeof createRoadTripPaths> | undefined;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  canvasPaint: string | CanvasGradient;
  opacity: number;
}

/**
 * The road as a line: what lies under the stroked figure.
 */
export const paintRoadLine = ({
  roadPaths,
  isFilled,
  context,
  canvasPaint,
  opacity,
}: IPaintRoadLineInput) => {
  if (roadPaths && !isFilled) {
    // Filled off: the whole scene as a wireframe, and depth is line
    // weight — the far range a hairline, the hillside heavier, the
    // near lane heaviest. Nothing is filled, so the layers read by
    // their edges alone.
    const wire = (path: Path2D, alpha: number, widthPx: number) => {
      context.strokeStyle = canvasPaint;
      context.lineWidth = widthPx;
      setAlpha(context, opacity * alpha);
      context.stroke(path);
    };
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.5);
    context.fill(roadPaths.brightStars);
    wire(roadPaths.moon, 0.7, 1);
    wire(roadPaths.far, 0.3, 0.8);
    wire(roadPaths.farTrees, 0.28, 0.6);
  }
};

interface IPaintRoadLandscapeInput {
  roadPaths: ReturnType<typeof createRoadTripPaths> | undefined;
  isFilled: boolean;
  context: CanvasRenderingContext2D;
  opacity: number;
  canvasPaint: string | CanvasGradient;
  baseline: number;
}

/**
 * The road as a filled landscape.
 */
export const paintRoadLandscape = ({
  roadPaths,
  isFilled,
  context,
  opacity,
  canvasPaint,
  baseline,
}: IPaintRoadLandscapeInput) => {
  if (roadPaths && isFilled) {
    // The night sky: stars, then the moon and its halo.
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.35);
    context.fill(roadPaths.stars);
    setAlpha(context, opacity * 0.9);
    context.fill(roadPaths.brightStars);
    const [mx, my, mr] = roadPaths.moonCentre;
    const moonlight = context.createRadialGradient(mx, my, 0, mx, my, mr);
    moonlight.addColorStop(0, 'rgba(255,255,255,0.28)');
    moonlight.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = moonlight;
    setAlpha(context, opacity);
    context.fill(roadPaths.moonHalo);
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.85);
    context.fill(roadPaths.moon);
    // Behind the hillside: the far range, seen through air — lit at
    // its ridge, sinking into haze — and its tree line.
    context.fillStyle = canvasPaint;
    setAlpha(context, opacity * 0.2);
    context.fill(roadPaths.far);
    const haze = context.createLinearGradient(
      0,
      roadPaths.rangeTop,
      0,
      baseline,
    );
    haze.addColorStop(0, 'rgba(255,255,255,0.16)');
    haze.addColorStop(0.5, 'rgba(0,0,0,0.25)');
    haze.addColorStop(1, 'rgba(0,0,0,0.6)');
    context.fillStyle = haze;
    setAlpha(context, opacity);
    context.fill(roadPaths.far);
    context.fillStyle = canvasPaint;
    setAlpha(context, opacity * 0.28);
    context.fill(roadPaths.farTrees);
  }
};

interface IStrokeRoadLineInput {
  roadPaths: ReturnType<typeof createRoadTripPaths> | undefined;
  isFilled: boolean;
  roadTripRef: RefObject<{
    beatLevel: number;
    trackedAt: number;
    flashAt: number;
    glow: number;
    hill: number[];
  }>;
  context: CanvasRenderingContext2D;
  canvasPaint: string | CanvasGradient;
  opacity: number;
}

/**
 * The line road's markings over its figure.
 */
export const strokeRoadLine = ({
  roadPaths,
  isFilled,
  roadTripRef,
  context,
  canvasPaint,
  opacity,
}: IStrokeRoadLineInput) => {
  if (roadPaths && !isFilled) {
    const trip = roadTripRef.current;
    const wire = (path: Path2D, alpha: number, widthPx: number) => {
      context.strokeStyle = canvasPaint;
      context.lineWidth = widthPx;
      setAlpha(context, opacity * alpha);
      context.stroke(path);
    };
    // The road's two edges over the hillside's own outline, the lane
    // line between them, then the two lanes at two weights with the
    // verge trees between.
    wire(roadPaths.edges, 0.6, 1);
    wire(roadPaths.dashes, 0.45, 1);
    const wireLane = (lane: RoadLane, weight: number, alpha: number) => {
      wire(lane.body, alpha, weight);
      wire(lane.cabin, alpha * 0.7, weight * 0.8);
      wire(lane.wheels, alpha, weight * 0.8);
      wire(lane.wheelRims, alpha * 0.8, weight * 0.6);
      context.fillStyle = '#fff';
      setAlpha(context, opacity * alpha * (0.5 + trip.glow * 0.5));
      context.fill(lane.lamps);
      context.fillStyle = canvasPaint;
      setAlpha(context, opacity * alpha * (0.4 + trip.glow * 0.6));
      context.fill(lane.tail);
    };
    wireLane(roadPaths.farLane, 0.9, 0.55);
    wire(roadPaths.near, 0.75, 1);
    wireLane(roadPaths.nearLane, 1.4, 1);
  }
};

interface IStrokeRoadLandscapeInput {
  roadPaths: ReturnType<typeof createRoadTripPaths> | undefined;
  isFilled: boolean;
  roadTripRef: RefObject<{
    beatLevel: number;
    trackedAt: number;
    flashAt: number;
    glow: number;
    hill: number[];
  }>;
  context: CanvasRenderingContext2D;
  baseline: number;
  opacity: number;
  figure: Path2D;
  canvasPaint: string | CanvasGradient;
}

/**
 * The filled road's markings, centre line and scenery over it.
 */
export const strokeRoadLandscape = ({
  roadPaths,
  isFilled,
  roadTripRef,
  context,
  baseline,
  opacity,
  figure,
  canvasPaint,
}: IStrokeRoadLandscapeInput) => {
  if (roadPaths && isFilled) {
    const trip = roadTripRef.current;
    // Ground: lit at the ridge, dark at the foot, grass on the verge.
    const ground = context.createLinearGradient(
      0,
      roadPaths.ridgeTop,
      0,
      baseline,
    );
    ground.addColorStop(0, 'rgba(255,255,255,0.22)');
    ground.addColorStop(0.3, 'rgba(0,0,0,0)');
    ground.addColorStop(1, 'rgba(0,0,0,0.5)');
    context.fillStyle = ground;
    setAlpha(context, opacity);
    context.fill(figure);
    context.strokeStyle = '#000';
    context.lineWidth = 1;
    setAlpha(context, opacity * 0.4);
    context.stroke(roadPaths.tufts);
    // The asphalt along the ridge: a dark stripe with light edges and
    // the centre line between the lanes.
    context.lineWidth = roadPaths.half * 2;
    setAlpha(context, opacity * 0.6);
    context.stroke(roadPaths.asphalt);
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    setAlpha(context, opacity * 0.4);
    context.stroke(roadPaths.edges);
    context.lineWidth = 1.5;
    setAlpha(context, opacity * 0.6);
    context.stroke(roadPaths.dashes);
    const strength = 0.22 + trip.glow * 0.35 + roadPaths.thump * 0.3;
    const paintLane = (lane: RoadLane, depth: number) => {
      // Every vehicle's glow, then its beam falling off along its
      // length, then the vehicle and its lamps. `depth` dims the far lane.
      context.fillStyle = canvasPaint;
      setAlpha(
        context,
        opacity * depth * (0.08 + trip.glow * 0.18 + roadPaths.thump * 0.12),
      );
      context.fill(lane.halo);
      lane.beams.forEach((beam) => {
        const [fx, fy] = beam.from;
        const [bx, by] = beam.to;
        const light = context.createLinearGradient(fx, fy, bx, by);
        light.addColorStop(
          0,
          'rgba(255,255,255,STRENGTH)'.replace(
            'STRENGTH',
            (strength * depth).toFixed(3),
          ),
        );
        light.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = light;
        setAlpha(context, opacity);
        context.fill(beam.path);
      });
      context.fillStyle = canvasPaint;
      setAlpha(context, opacity * depth);
      context.fill(lane.body);
      context.fillStyle = '#000';
      setAlpha(context, opacity * (0.5 + (1 - depth) * 0.3));
      context.fill(lane.body);
      context.fillStyle = canvasPaint;
      setAlpha(context, opacity * depth);
      context.fill(lane.body);
      context.fillStyle = '#000';
      setAlpha(context, opacity * 0.5);
      context.fill(lane.cabin);
      context.fill(lane.wheels);
      context.strokeStyle = '#fff';
      context.lineWidth = 1;
      setAlpha(context, opacity * 0.6 * depth);
      context.stroke(lane.wheels);
      context.stroke(lane.wheelRims);
      context.fillStyle = canvasPaint;
      setAlpha(context, opacity * depth * 0.9);
      context.fill(lane.hubs);
      context.fillStyle = '#fff';
      setAlpha(context, opacity * depth * (0.6 + trip.glow * 0.4));
      context.fill(lane.lamps);
      // Tail lights breathing with the level, in the look's colour.
      context.fillStyle = canvasPaint;
      setAlpha(context, opacity * depth * (0.35 + trip.glow * 0.65));
      context.fill(lane.tail);
      context.fillStyle = '#fff';
      setAlpha(context, opacity * depth * trip.glow * 0.5);
      context.fill(lane.tail);
    };
    // The far lane, then the verge trees in front of it, then the
    // near lane in front of the trees: three depths.
    paintLane(roadPaths.farLane, 0.7);
    context.fillStyle = canvasPaint;
    setAlpha(context, opacity * 0.9);
    context.fill(roadPaths.near);
    context.fillStyle = '#000';
    setAlpha(context, opacity * 0.55);
    context.fill(roadPaths.near);
    context.fillStyle = '#fff';
    setAlpha(context, opacity * (0.12 + trip.glow * 0.25));
    context.fill(roadPaths.lit);
    paintLane(roadPaths.nearLane, 1);
  }
};
