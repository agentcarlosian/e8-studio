# Quantum background

Quantum depicts the hydrogen state **n = 4, l = 3, m = +1** as a sampled probability cloud. The visual direction comes from [kavan010/Atoms](https://github.com/kavan010/Atoms), particularly its probability sampling and density color mapping. Studio uses an independent implementation; no source files, binaries, or images from that project are bundled.

`src/fx/quantum-orbitals.js` constructs numerical cumulative distributions for `r² |R_nl(r)|²` and `|P_l^m(cos θ)|²`. Sampling `cos θ` accounts for the angular volume element; azimuth is uniform for the complex spherical harmonic. Associated Laguerre and Legendre polynomials preserve the hydrogen radial and angular nodes. The common normalization factors cancel when normalizing each distribution. Radial sampling extends to `10 n²` Bohr radii, with scene framing based on the 99.5th percentile.

Desktop draws 64,000 persistent point samples in one additive draw above a black background. Mobile uses 32,000 samples with adjusted exposure; the Canvas fallback uses 6,000. Buffers are created on demand and reused. This avoids the reference's per-particle sphere draws. Foreground scene geometry renders after the cloud, and background points do not write depth.

Brightness and warm/cool density colors are presentation choices. Samples represent possible measurements of a **single electron**, not thousands of electrons. The density is stationary; slow view rotation and bounded azimuthal sample circulation reveal its structure. Display motion is not a claim about electron trajectories or physical time. This hydrogen model does not simulate multi-electron atoms, spin, or state transitions.

The probability interpretation follows the [MIT hydrogen orbital lecture](https://ocw.mit.edu/courses/5-111sc-principles-of-chemical-science-fall-2014/pages/unit-i-the-atom/lecture-6-hydrogen-atom-wavefunctions-orbitals/). `scripts/test_quantum_orbitals.mjs` checks analytic nodes, expected radial/angular moments, deterministic sampling, and budgets. Background smoke checks cover rendering, animation, intensity, mobile context restoration, and Canvas fallback.
