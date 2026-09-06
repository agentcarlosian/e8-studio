# Model exports

Open **Tools → Export** on desktop, or **Share and tools → Export** on mobile.
The panel captures a geometry record when it opens. Reopen it to capture a new
rotation or deformation. PNG uses the current render at the time of export.

| Format | Purpose | Coordinates / appearance |
| --- | --- | --- |
| PNG | Raster image | Current renderer output |
| SVG | Editable vector diagram | Orthographic XY diagram; E8 and Dynkin retain their specialized desktop diagrams |
| OBJ | Modeling tools | Unitless vertices, polygon faces and edge lines; points for point clouds |
| PLY | Meshes and point clouds | Unitless XYZ vertices, indexed faces and edges |
| CSV | Analysis / spreadsheets | Zero-based vertex index and XYZ coordinates matching OBJ |
| JSON | Original mathematical data | Preserves native 4D / 8D coordinates and model-specific metadata |
| STL | Printing | Binary triangles; import as millimeters |
| 3MF | Printing | Core mesh package with explicit millimeter units |

All nine model workspaces have the six digital formats. STL and 3MF are enabled
for Platonic/star solids and regular 4D polytopes. Regular Platonic solids offer
a solid convex hull or joined struts. Star solids and 4D projections use joined
struts. The solid hull encloses the deformed vertices; it may simplify concave
deformations. Polygon faces in a digital 4D OBJ are projected 2-faces and can
intersect, so they are not used directly as the printing surface.

Desktop Bloom and SDF geometry exports contain the underlying Coxeter-plane
root cloud, not a reconstructed shader surface. Tiling files contain its flat
mathematical tiles; quasicrystal files contain the physical-space lattice patch.
Mobile geometry follows its existing CPU model records, including Bloom depth,
tiling relief, and the selected quasicrystal mode. These differences are stated
in the panel. Camera orientation, lighting, background, effects, and display
face visibility do not change the mathematical geometry record.

## Print mesh construction

Print size is the longest bounding-box dimension (10–300 mm). A frame uses
capsules at the selected strut diameter (0.5–20 mm). Capsules are unioned in a
single sampled distance field and contoured with a conforming six-tetrahedron
subdivision. The grid spacing is one third of the diameter, with a maximum of
144 samples along the largest dimension; requests beyond this budget receive
an actionable error. The triangulated output is fitted to the requested size
and placed on z=0. Sampling and final normalization make strut diameter
approximate. Very close projected features can fuse, as expected for a union.

The generator checks finite coordinates, nondegenerate triangles, two oppositely
oriented incident faces per edge, and positive enclosed volume after converting
to the float32 coordinates used by STL. Work yields between batches and closing
the panel aborts before file delivery. A 900,000-triangle cap bounds output.

These checks establish geometric closure, not printer-specific manufacturability.
No print settings, supports, material profiles, textures or colors are embedded.
Review the result in a slicer, especially dense 120-cell / 600-cell projections.

The 3MF writer follows the [3MF Core specification](https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md):
an OPC ZIP with content types, package relationship, and one mesh/build item.
ZIP entries use the allowed STORE method and CRC32. No runtime network or
additional package is needed; the modules are included in standalone builds.

## Verification

- `node scripts/test_model_files.mjs`: all digital records, five solid bodies,
  six 4D frames, dimensions, winding, closure, invalid settings and cancellation.
- `python scripts/test_print_packages.py`: independent ZIP/CRC/XML readback and
  STL float-coordinate welding, edge incidence, winding, volume and coordinate
  agreement with 3MF. Run after the Node test; uses the verifier's NumPy dependency.
- `python scripts/test_export_panel.py`: actual desktop/mobile downloads,
  Tools placement, responsive layout, format parsing and cancellation. Run after
  `npm run build:web` and `npm run build:mobile`.
- `python scripts/test_shape_controls.py`: the eleven face/edge OBJ models,
  current 4D projection, JSON and persistent face-visibility controls.
