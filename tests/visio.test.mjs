import test from 'node:test';
import assert from 'node:assert/strict';
import { masterSeed, seed, redact } from '../src/model.js';
import { toVisio, toVisioStencil } from '../src/io.js';
function unzip(bytes) {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out={};let p=0;
 while(v.getUint32(p,true)===0x04034b50) {
  const len=v.getUint32(p+18,true),n=v.getUint16(p+26,true),extra=v.getUint16(p+28,true);
  const name=new TextDecoder().decode(bytes.subarray(p+30,p+30+n)),start=p+30+n+extra;
  out[name]=new TextDecoder().decode(bytes.subarray(start,start+len));p=start+len;
 }
 assert.equal(v.getUint32(p,true),0x02014b50);
 return out;
}
test('native Visio package contains four pages, metadata and two endpoint connections per flow',()=>{
 const d=masterSeed(),p=unzip(toVisio(d));
 assert.equal(Object.keys(p).filter(k=>/^visio\/pages\/page\d+\.xml$/.test(k)).length,4);
 const master=p['visio/pages/page1.xml'];
 assert.equal((master.match(/<Connect /g)||[]).length,d.cases[0].views[0].flows.length*2);
 for(const star of d.catalog.stars) assert.ok(master.includes(star.id));
 assert.match(master,/CC_catalog_provenance/); assert.match(master,/CC_appearance_id/);
 assert.match(master,/N="LinePattern" V="3"/);
 assert.match(p['[Content_Types].xml'],/application\/vnd.ms-visio.drawing.main\+xml/);
 assert.match(p['visio/pages/pages.xml'],/approval|Unverified/);
});
test('Visio stencil exports exactly 17 editable master shapes with catalog identity',()=>{
 const p=unzip(toVisioStencil(masterSeed()));
 assert.equal((p['visio/masters/masters.xml'].match(/<Master /g)||[]).length,17);
 assert.match(p['visio/masters/master3.xml'],/CC-ACD/);
 assert.match(p['visio/masters/master3.xml'],/CC_behavior/);
 assert.match(p['[Content_Types].xml'],/stencil.main\+xml/);
 assert.ok(!Object.keys(p).some(x=>x.includes('vba')||x.includes('embeddings')));
});
test('redacted Visio drawings and stencils physically exclude restricted content',()=>{
 const d=masterSeed(); d.catalog.stars[0].label='SECRET_SENTINEL';d.catalog.stars[0].classification='restricted';
 d.catalog.stars[1].description='SECRET_SENTINEL';d.cases[0].description='SECRET_SENTINEL';
 const safe=redact(d,d.cases[0].id);
 for(const encode of [toVisio,toVisioStencil]) assert.ok(!new TextDecoder().decode(encode(safe)).includes('SECRET_SENTINEL'));
});
test('Visio escapes hostile text without adding scripts, formulas or external relationships',()=>{
 const d=seed();d.catalog.stars[0].label='<script>&"=RUNADDON("bad")';
 const p=unzip(toVisio(d)), all=Object.values(p).join('');
 assert.ok(all.includes('&lt;script&gt;'));assert.ok(!all.includes('<script>'));
 assert.ok(!all.includes('TargetMode="External"'));assert.ok(!all.includes('F="RUNADDON'));
});
test('Visio refuses dangling endpoints before creating an incomplete package',()=>{
 const d=masterSeed();d.cases[0].views[0].flows[0].target='MISSING';
 assert.throws(()=>toVisio(d),/structural errors/);
});
