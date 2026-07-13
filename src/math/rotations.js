// rotations.js — 3D and 4D rotation matrix utilities
// Pure functions; no three.js dependency so views can be tested standalone.

export const ID3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Multiply two 3x3 row-major matrices. */
export function mul3(a, b) {
  return [
    a[0]*b[0] + a[1]*b[3] + a[2]*b[6],
    a[0]*b[1] + a[1]*b[4] + a[2]*b[7],
    a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
    a[3]*b[0] + a[4]*b[3] + a[5]*b[6],
    a[3]*b[1] + a[4]*b[4] + a[5]*b[7],
    a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
    a[6]*b[0] + a[7]*b[3] + a[8]*b[6],
    a[6]*b[1] + a[7]*b[4] + a[8]*b[7],
    a[6]*b[2] + a[7]*b[5] + a[8]*b[8],
  ];
}

/** Build a 3x3 rotation matrix from axis-angle (axis = unit vector, angle in radians). */
export function axisAngle3(axis, angle) {
  const [x, y, z] = axis;
  const c = Math.cos(angle), s = Math.sin(angle), C = 1 - c;
  return [
    c + x*x*C,     x*y*C - z*s, x*z*C + y*s,
    y*x*C + z*s,   c + y*y*C,   y*z*C - x*s,
    z*x*C - y*s,   z*y*C + x*s, c + z*z*C,
  ];
}

/** Build a 4x4 rotation in the plane spanned by axes i and j (rotates coord i toward j by angle). */
export function planeRot4(i, j, angle) {
  const M = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const c = Math.cos(angle), s = Math.sin(angle);
  M[i*4 + i] = c;  M[i*4 + j] = -s;
  M[j*4 + i] = s;  M[j*4 + j] =  c;
  return M;
}

export const ID4 = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

/** Multiply two 4x4 row-major matrices. */
export function mul4(a, b) {
  const out = new Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[r*4 + c] =
        a[r*4+0]*b[0*4+c] +
        a[r*4+1]*b[1*4+c] +
        a[r*4+2]*b[2*4+c] +
        a[r*4+3]*b[3*4+c];
    }
  }
  return out;
}

/** Apply a 4x4 matrix to a 4-vector (row vector × matrix). */
export function apply4(M, v) {
  return [
    M[0]*v[0] + M[1]*v[1] + M[2]*v[2] + M[3]*v[3],
    M[4]*v[0] + M[5]*v[1] + M[6]*v[2] + M[7]*v[3],
    M[8]*v[0] + M[9]*v[1] + M[10]*v[2] + M[11]*v[3],
    M[12]*v[0] + M[13]*v[1] + M[14]*v[2] + M[15]*v[3],
  ];
}

/** Apply a 3x3 matrix to a 3-vector. */
export function apply3(M, v) {
  return [
    M[0]*v[0] + M[1]*v[1] + M[2]*v[2],
    M[3]*v[0] + M[4]*v[1] + M[5]*v[2],
    M[6]*v[0] + M[7]*v[1] + M[8]*v[2],
  ];
}

/** Project a 4-vector to 3-vector by perspective division with a depth offset. */
export function project4to3(v4, wOffset = 0) {
  const denom = 1 - 0.4 * wOffset * v4[3];
  return [v4[0] / denom, v4[1] / denom, v4[2] / denom, v4[3]];
}
