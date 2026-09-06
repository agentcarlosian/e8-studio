"""Independently read generated STL/3MF files; weld STL vertices before topology checks."""
from pathlib import Path
import io
import struct
import zipfile
import xml.etree.ElementTree as ET
import numpy as np

ROOT = Path(__file__).resolve().parent.parent

def validate_pair(path):
    raw = path.with_suffix('.stl').read_bytes()
    count = struct.unpack_from('<I', raw, 80)[0]
    assert len(raw) == 84 + 50 * count
    dtype = np.dtype([('normal', '<f4', (3,)), ('vertices', '<f4', (3,3)), ('attr', '<u2')])
    triangles = np.frombuffer(raw, dtype=dtype, offset=84)['vertices'].astype(np.float64)
    vertices, indices = np.unique(triangles.reshape(-1,3), axis=0, return_inverse=True)
    faces = indices.reshape(-1,3)
    assert np.isfinite(vertices).all()
    assert abs(vertices[:,2].min()) < 1e-5
    cross = np.cross(triangles[:,1]-triangles[:,0], triangles[:,2]-triangles[:,0])
    assert (np.linalg.norm(cross,axis=1) > 1e-12).all()
    assert np.einsum('ij,ij->i',triangles[:,0],np.cross(triangles[:,1],triangles[:,2])).sum() / 6 > 0
    edges = np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]])
    _, counts = np.unique(np.sort(edges,axis=1), axis=0, return_counts=True)
    assert (counts == 2).all(), f'{path.stem}: STL has open or multiply shared edges after welding'
    directed = np.sort(edges[:,0] * len(vertices) + edges[:,1])
    reverse = np.sort(edges[:,1] * len(vertices) + edges[:,0])
    assert np.array_equal(directed, reverse)
    with zipfile.ZipFile(path) as package:
        assert package.testzip() is None
        assert set(package.namelist()) == {'[Content_Types].xml','_rels/.rels','3D/3dmodel.model'}
        rels = ET.fromstring(package.read('_rels/.rels'))
        assert rels[0].attrib['Target'] == '/3D/3dmodel.model'
        assert rels[0].attrib['Type'].endswith('/3dmanufacturing/2013/01/3dmodel')
        types = ET.fromstring(package.read('[Content_Types].xml'))
        assert any(e.attrib.get('ContentType') == 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' for e in types)
        points=[]; face_index=0; item=False
        for event, node in ET.iterparse(io.BytesIO(package.read('3D/3dmodel.model')), events=['start','end']):
            tag=node.tag.split('}')[-1]
            if event=='start' and tag=='model': assert node.attrib['unit']=='millimeter'
            if event!='end': continue
            if tag=='vertex': points.append([float(node.attrib[k]) for k in ['x','y','z']])
            elif tag=='triangle':
                xyz=[points[int(node.attrib[k])] for k in ['v1','v2','v3']]
                assert np.array_equal(xyz,triangles[face_index]);face_index+=1
            elif tag=='item': assert node.attrib['objectid']=='1';item=True
            node.clear()
        assert face_index==count and item
    print(f'{path.stem}: {count} triangles; STL welded closure and 3MF coordinates/units/package passed')

if __name__=='__main__':
    for path in sorted((ROOT/'smoke_shots/model-files').glob('*.3mf')): validate_pair(path)
