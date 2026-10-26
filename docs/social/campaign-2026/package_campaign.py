"""Reconcile verified publishing receipts and package reviewed campaign outputs."""

import csv
import hashlib
import json
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'outputs/01a1756e-064d-7e03-970a-b2a37d7937b3/FluidEQ-Marketing-Kit'


def main():
    schedule=OUT/'schedule/campaign.json'
    data=json.loads(schedule.read_text(encoding='utf-8'))
    ledger=json.loads((OUT/'schedule/publishing-ledger.json').read_text(encoding='utf-8'))
    for row in data['posts']:
        receipt=next((r for r in ledger['receipts'] if r['campaign_id']==row['id']),None)
        if receipt and receipt.get('state')=='scheduled_verified':
            row['status']='Scheduled - verified'
    schedule.write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
    csvpath=OUT/'schedule/FluidEQ-Content-Schedule.csv'
    with csvpath.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);fields=reader.fieldnames
    with csvpath.open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader()
        for r in data['posts']:writer.writerow(dict(r,files=';'.join(r['files'])))
    required=[OUT/'FluidEQ-Two-Month-Schedule.xlsx',OUT/'FluidEQ-Campaign-Calendar.pdf',OUT/'print/FluidEQ-Postcards-6x4.pdf',OUT/'print/FluidEQ-Flyers-Letter.pdf']
    assert all(p.is_file() and p.stat().st_size>0 for p in required)
    assert len(list((OUT/'social').glob('*.png')))==81
    # Keep authoring diagnostics out of the handoff.
    files=[p for p in OUT.rglob('*') if p.is_file() and '.inspect.' not in p.name]
    manifest={str(p.relative_to(OUT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.name!='SHA256.json'}
    (OUT/'SHA256.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    archive=OUT.parent/'FluidEQ-Marketing-Kit.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in OUT.rglob('*'):
            if p.is_file() and '.inspect.' not in p.name:z.write(p,str(Path(OUT.name)/p.relative_to(OUT)))
    with zipfile.ZipFile(archive) as z:assert z.testzip() is None
    print(json.dumps({'archive':str(archive),'files':len(manifest)+1,'bytes':archive.stat().st_size,'verified_native_posts':len(ledger['receipts'])}))


if __name__=='__main__':main()
