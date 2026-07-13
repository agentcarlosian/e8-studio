// sources.js — factual provenance for educational content.
//
// Essays reference these records through `sourceIds`.  Prefer primary papers,
// university mathematics pages, and established reference works.  `scope`
// records exactly what the source is being used to support; a source URL is not
// a blanket endorsement of every sentence in an essay.

export const FACT_SOURCES = {
  'mit-e8-plane': {
    title: 'The E8 root system',
    author: 'David Vogan, MIT Mathematics',
    url: 'https://math.mit.edu/~dav/e8plane.html',
    scope: '240 roots; eight projected circles with 30 roots at each radius',
    tier: 'university',
  },
  'aim-e8-technical': {
    title: 'The Character Table for E8 — Technical Details',
    author: 'American Institute of Mathematics',
    url: 'https://aimath.org/E8/technicaldetails.html',
    scope: 'E8 rank, dimension, root count, and Weyl-group order',
    tier: 'research-institute',
  },
  'kostant-gosset-circles': {
    title: 'Experimental evidence for the occurrence of E8 in nature and the radii of the Gosset circles',
    author: 'Bertram Kostant',
    url: 'https://arxiv.org/abs/1003.0046',
    scope: 'eight Gosset circles; Coxeter-element orbits; McKay dimension labels',
    tier: 'primary-paper',
  },
  'stembridge-coxeter-planes': {
    title: 'Coxeter Planes',
    author: 'John R. Stembridge, University of Michigan',
    url: 'https://websites.umich.edu/~jrs/coxplane.html',
    scope: 'definition of a Coxeter plane and order-h rotational action',
    tier: 'university',
  },
  'mckay-michigan-notes': {
    title: 'McKay correspondence lecture notes',
    author: 'University of Michigan',
    url: 'https://dept.math.lsa.umich.edu/~idolga/McKaybook.pdf',
    scope: 'binary polyhedral groups, irreducible representations, and affine ADE McKay graphs',
    tier: 'university-notes',
  },
  'mathworld-600-cell': {
    title: '600-Cell',
    author: 'Wolfram MathWorld',
    url: 'https://mathworld.wolfram.com/600-Cell.html',
    scope: '600-cell element counts and duality with the 120-cell',
    tier: 'reference',
  },
  'mathworld-platonic-solids': {
    title: 'Platonic Solid',
    author: 'Wolfram MathWorld',
    url: 'https://mathworld.wolfram.com/PlatonicSolid.html',
    scope: 'definition, enumeration, and historical attribution of the five convex regular polyhedra',
    tier: 'reference',
  },
  'hart-sphere-tracing': {
    title: 'Sphere tracing: A geometric method for the antialiased ray tracing of implicit surfaces',
    author: 'John C. Hart',
    url: 'https://doi.org/10.1007/s003710050084',
    scope: 'sphere tracing, signed distance bounds, implicit-surface rendering, and distance operations',
    tier: 'primary-paper',
  },
  'baez-octonions': {
    title: 'The Octonions',
    author: 'John C. Baez',
    url: 'https://arxiv.org/abs/math/0105155',
    scope: 'normed division algebras, nonassociativity, and relationships with exceptional Lie groups',
    tier: 'primary-paper',
  },
  'gross-heterotic-string': {
    title: 'Heterotic String',
    author: 'David Gross, Jeffrey Harvey, Emil Martinec, and Ryan Rohm',
    url: 'https://doi.org/10.1103/PhysRevLett.54.502',
    scope: 'construction of the heterotic string and the Spin(32)/Z2 and E8 x E8 gauge-group consistency result',
    tier: 'primary-paper',
  },
  'mactutor-plato': {
    title: 'Plato biography',
    author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Plato/',
    scope: 'Plato chronology, Academy context, and the Timaeus solid-to-element assignments',
    tier: 'university-history',
  },
  'mactutor-theaetetus': {
    title: 'Theaetetus biography',
    author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Theaetetus/',
    scope: 'Theaetetus chronology and qualified historical attribution for the octahedron and icosahedron',
    tier: 'university-history',
  },
  'mactutor-euclid': {
    title: 'Euclid biography',
    author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Euclid/',
    scope: 'Euclid chronology and the Elements culmination in constructions of the regular solids',
    tier: 'university-history',
  },
  'mactutor-borcherds': {
    title: 'Richard Borcherds biography',
    author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Borcherds/',
    scope: 'Borcherds chronology, moonshine work, and 1998 Fields Medal context',
    tier: 'university-history',
  },
  'mactutor-kepler': {
    title: 'Johannes Kepler biography', author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Kepler/', scope: 'Kepler chronology and mathematical work', tier: 'university-history',
  },
  'mactutor-schlafli': {
    title: 'Ludwig Schläfli biography', author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Schlafli/', scope: 'Schläfli chronology and work on higher-dimensional geometry', tier: 'university-history',
  },
  'mactutor-cartan': {
    title: 'Élie Cartan biography', author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Cartan/', scope: 'Cartan chronology and classification work in Lie theory', tier: 'university-history',
  },
  'mactutor-coxeter': {
    title: 'H. S. M. Coxeter biography', author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Coxeter/', scope: 'Coxeter chronology and contributions to geometry and regular polytopes', tier: 'university-history',
  },
  'mactutor-freudenthal': {
    title: 'Hans Freudenthal biography', author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Freudenthal/', scope: 'Freudenthal chronology and mathematical work', tier: 'university-history',
  },
  'mactutor-mckay': {
    title: 'John McKay (1939–2022)', author: 'Centre de recherches mathématiques, Université de Montréal',
    url: 'https://www.crmath.ca/2022/04/27/john-mckay-1939-2022/', scope: 'McKay chronology, mathematical career, and memorial context', tier: 'university-history',
  },
  'mactutor-conway': {
    title: 'John Horton Conway biography', author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Conway/', scope: 'Conway chronology and contributions to group theory and combinatorics', tier: 'university-history',
  },
  'bourbaki-history': {
    title: 'Nicolas Bourbaki biography', author: 'MacTutor History of Mathematics, University of St Andrews',
    url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Bourbaki/', scope: 'Bourbaki history, collective authorship, founding, and publication program', tier: 'university-history',
  },
  'mathworld-kepler-poinsot': {
    title: 'Kepler-Poinsot Solid',
    author: 'Wolfram MathWorld',
    url: 'https://mathworld.wolfram.com/Kepler-PoinsotSolid.html',
    scope: 'the four regular star polyhedra, their names, dual pairs, and Schläfli symbols',
    tier: 'reference',
  },
  'mathworld-120-cell': {
    title: '120-Cell',
    author: 'Wolfram MathWorld',
    url: 'https://mathworld.wolfram.com/120-Cell.html',
    scope: '120-cell element counts, Schläfli symbol, and duality with the 600-cell',
    tier: 'reference',
  },
  'mathworld-schlafli-symbol': {
    title: 'Schläfli Symbol',
    author: 'Wolfram MathWorld',
    url: 'https://mathworld.wolfram.com/SchlaefliSymbol.html',
    scope: 'definition and examples of Schläfli notation for regular polytopes',
    tier: 'reference',
  },
  'springer-e8-highest-root': {
    title: 'Linear models of the exceptional Lie algebra e8',
    author: 'Revista de la Real Academia de Ciencias Exactas, Físicas y Naturales',
    url: 'https://link.springer.com/article/10.1007/s13398-025-01768-3',
    scope: 'affine root alpha_0 as the negative highest root and the extended E8 diagram',
    tier: 'primary-paper',
  },
  'green-affine-kac-moody': {
    title: 'Full heaps and representations of affine Kac–Moody algebras',
    author: 'R. M. Green',
    url: 'https://arxiv.org/abs/math/0605768',
    scope: 'affine Kac–Moody algebras as infinite-dimensional algebras',
    tier: 'primary-paper',
  },
};

export function getFactSource(id) {
  return FACT_SOURCES[id] || null;
}
