import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const {version} = JSON.parse(await readFile('package.json','utf8'));
const names = (await readdir('dist')).filter(name => /^Computation-Constellations-17-Stars-.*\.(zip|tar\.gz)$/.test(name)).filter(name => name.includes('-'+version+'-')).sort();
const records = [];
for (const name of names) {
 const file = await readFile(`dist/${name}`);
 records.push({file:name, bytes:(await stat(`dist/${name}`)).size, sha256:createHash('sha256').update(file).digest('hex')});
}
await writeFile('dist/SHA256SUMS.txt', records.map(x=>`${x.sha256}  ${x.file}`).join('\n')+'\n');
await writeFile('dist/release-manifest.json', JSON.stringify({version,edition:'17-star master',builtAt:new Date().toISOString(),publisherSigned:false,notarized:false,macSignature:'ad-hoc',verification:{modelTests:22,macArm64:'Packaged smoke test',macX64:'Packaged smoke test via compatibility runtime',windowsX64:'Archive and bundled-source verification only; not launch-tested',linuxX64:'Archive and bundled-source verification only; not launch-tested'},artifacts:records},null,2)+'\n');
console.log(records.map(x=>`${x.file}: ${(x.bytes/1024/1024).toFixed(1)} MiB`).join('\n'));
