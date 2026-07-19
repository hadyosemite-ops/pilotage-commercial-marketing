// Evite d'avoir a repeter un try/catch dans chaque route async :
// enveloppe un handler async et transmet toute erreur a Express via next().
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
