import { modelOBJ, modelPLY, modelCSV, modelSVG } from '../services/model-files.js';
import { createPrintMesh } from '../services/print-mesh.js';
import { meshSTL, mesh3MF } from '../services/print-files.js';

const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const regular = new Set(['tetrahedron','cube','octahedron','dodecahedron','icosahedron']);

export function renderModelExport(model, printEnabled) {
  const solid=printEnabled && model.data?.kind==='polyhedron' && regular.has(model.name);
  const button=(format,title,description)=>`<button type="button" data-file-format="${format}"><strong>${title}</strong><span>${description}</span></button>`;
  return `<style>
    .learning-dialog:has(>.model-export){width:min(760px,calc(100vw - 32px));max-width:760px;max-height:90dvh}
    .model-export{color:var(--text,#edeaf2);font:14px/1.5 system-ui,sans-serif;max-width:700px;margin:auto}
    .model-export *{box-sizing:border-box}.model-export header{display:flex;justify-content:space-between;gap:18px;align-items:start}
    .model-export h2{margin:0;font-size:26px}.model-export h3{font-size:15px;margin:22px 0 8px}.model-export p{color:var(--muted,#b8b4c6);margin:6px 0 12px}
    .model-export .export-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.model-export .export-data{grid-template-columns:repeat(4,minmax(0,1fr))}
    .model-export button{font:inherit;color:inherit;background:#ffffff08;border:1px solid #ffffff29;border-radius:10px;padding:12px;text-align:left;cursor:pointer;min-height:44px}
    .model-export button:hover{background:#ffffff15;border-color:#cbb878}.model-export button:focus-visible,.model-export input:focus-visible,.model-export select:focus-visible{outline:2px solid #e7c76b;outline-offset:3px}
    .model-export button span{display:block;font-size:12px;color:#bbb7c8;margin-top:3px}.model-export button:disabled{opacity:.5;cursor:wait}
    .model-export .export-print{border:1px solid #cbb87855;border-radius:12px;padding:14px;margin-top:22px}.model-export .export-print h3{margin-top:0}
    .model-export .export-fields{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}.model-export label{flex:1;min-width:120px;font-size:12px}
    .model-export input,.model-export select{display:block;width:100%;margin-top:5px;background:#17151f;color:#eee;border:1px solid #ffffff33;border-radius:7px;padding:9px;font:inherit}
    .model-export .export-status{display:block;min-height:24px;margin-top:14px;color:#e7c76b}.model-export progress{width:100%;accent-color:#e7c76b}
    dialog.model-export-dialog{border:1px solid #ffffff33;border-radius:16px;background:#111019;color:#eee;width:min(740px,95vw);max-height:90dvh;padding:24px}
    dialog.model-export-dialog::backdrop{background:#000b}
    @media(max-width:600px){.model-export .export-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.model-export h2{font-size:22px}}
  </style><section class="model-export" aria-labelledby="model-export-title">
    <header><div><h2 id="model-export-title">Export ${esc(model.name)}</h2><p>${model.vertices.length.toLocaleString()} vertices · ${model.edges.length.toLocaleString()} edges · ${model.faces.length.toLocaleString()} faces</p></div><button type="button" data-modal-close aria-label="Close export">✕</button></header>
    <p>${esc(model.note)}</p>
    <h3>Images & diagrams</h3><div class="export-grid">${button('png','PNG','Rendered scene')}${button('svg','SVG','Scalable XY diagram')}</div>
    <h3>Geometry & data</h3><div class="export-grid export-data">${button('obj','OBJ','Faces, lines & points')}${button('ply','PLY','Mesh & point cloud')}${button('csv','CSV','XYZ coordinate table')}${button('data','JSON','Original model data')}</div>
    <p>Geometry is captured when this panel opens. OBJ, PLY and CSV use unitless XYZ coordinates; JSON retains higher dimensions. SVG uses an orthographic XY view.</p>
    ${printEnabled ? `<div class="export-print"><h3>3D printing</h3><p>${solid ? 'Export a solid convex hull or a frame made from joined struts. A convex hull encloses the current vertices and can simplify deformations.' : 'Turn the projected edges into a solid frame. Intersecting struts are joined into a closed surface.'}</p>
    <div class="export-fields"><label>Construction<select name="print-mode">${solid ? '<option value="solid">Solid convex hull</option>' : ''}<option value="struts">Joined struts</option></select></label><label>Overall size (mm)<input name="print-size" type="number" min="10" max="300" value="80" step="1" required></label><label>Strut diameter (mm)<input name="print-thickness" type="number" min="0.5" max="20" value="3" step="0.1" required></label></div>
    <div class="export-grid">${button('3mf','3MF','Millimeter units included')}${button('stl','STL','Import as millimeters')}</div><p>Geometry only; no printer settings or colors. Check orientation, supports, and thin features in your slicer before printing.</p></div>` : '<p>STL and 3MF are available for Platonic solids and 4D polytopes. Point clouds, flat diagrams, and shader effects are offered above in formats suited to their geometry.</p>'}
    <output class="export-status" role="status" aria-live="polite"></output><progress hidden max="1" value="0" aria-label="Building print mesh"></progress>
  </section>`;
}

export function bindModelExport(host, {model, download, png, svg}) {
  const controller=new AbortController(), {signal}=controller;
  const status=host.querySelector('.export-status'),progress=host.querySelector('progress');
  const buttons=[...host.querySelectorAll('[data-file-format]')];
  const fields=[...host.querySelectorAll('input,select')];
  const mode=host.querySelector('[name="print-mode"]'),diameter=host.querySelector('[name="print-thickness"]');
  const sync=()=>{if(diameter) diameter.disabled=mode.value==='solid';};sync();mode?.addEventListener('change',sync,{signal});
  let busy=false;
  host.addEventListener('click',async event=>{
    const button=event.target.closest('[data-file-format]'); if(!button || busy) return;
    const format=button.dataset.fileFormat,printing=format==='stl'||format==='3mf';
    if(printing && fields.some(input=>!input.reportValidity())) return;
    busy=true;buttons.forEach(b=>b.disabled=true);fields.forEach(f=>f.disabled=true);
    status.textContent=printing ? 'Building a closed surface…' : 'Preparing export…';
    try {
      if(format==='png') { await png(); }
      else {
        let body,type='text/plain',extension=format;
        if(printing) {
          progress.hidden=false;
          const mesh=await createPrintMesh(model,{size:Number(host.querySelector('[name="print-size"]').value),thickness:Number(diameter.value),mode:mode.value,signal,onProgress:value=>{progress.value=value;}});
          body=format==='stl' ? meshSTL(mesh) : mesh3MF(mesh);type=format==='stl' ? 'model/stl' : 'model/3mf';
          status.textContent=`Closed surface checked: ${mesh.stats.triangles.toLocaleString()} triangles. `;
        } else if(format==='obj') body=modelOBJ(model);
        else if(format==='ply') body=modelPLY(model);
        else if(format==='csv') {body=modelCSV(model);type='text/csv';}
        else if(format==='svg') {body=svg?.() || modelSVG(model);type='image/svg+xml';}
        else {body=JSON.stringify(model.data,null,2);type='application/json';extension='json';}
        signal.throwIfAborted();
        const suffix=printing ? `_${host.querySelector('[name="print-size"]').value}mm_${mode.value}` : '';
        await download(new Blob([body],{type}),`${model.name.replace(/[^a-z0-9_-]/gi,'_')}${suffix}.${extension}`);
      }
      if(!signal.aborted) status.textContent=(printing ? status.textContent : '')+'Export delivered.';
    } catch(error) {if(!signal.aborted) status.textContent=`Export failed: ${error.message}`;}
    finally {busy=false;buttons.forEach(b=>b.disabled=false);fields.forEach(f=>f.disabled=false);sync();progress.hidden=true;}
  },{signal});
  return ()=>controller.abort();
}
