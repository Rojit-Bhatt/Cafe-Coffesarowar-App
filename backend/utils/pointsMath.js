// Points are stored as INTEGER centipoints everywhere in the DB, never as a
// float. 1 point = 100 centipoints; a balance of 1050 renders as "10.5".
//
// Why: a balance is mutated with $inc, so the arithmetic happens inside the
// database, where we can't round the result. Repeatedly $inc-ing a decimal
// accumulates binary error until a balance reads 10.499999999 and a $gte
// redemption guard rejects a customer who has exactly enough. Integers make
// that impossible while still preserving the fractional points the program
// promises (Rs 105 at 10% earns 10.5 points = 1050 centipoints).
//
// The boundary rule: centipoints never leave the backend. Services work in
// centi; API responses convert once, on the way out, via toPoints().
const CENTI_PER_POINT = 100;

// Points a bill earns, in centipoints.
//
//   points = billAmount x earnPercent / 100
//   centi  = points x 100 = billAmount x earnPercent
//
// so the /100 and the x100 cancel and the whole thing is one multiply, which
// is also why earnPercent maps so cleanly onto this representation: 100% of a
// Rs 105 bill is 10500 centi (105 points), 10% is 1050 centi (10.5 points).
//
// Rounds to the nearest centipoint. Fractions below that are not
// representable and are not worth representing — a hundredth of a point.
const earnCenti = (billAmount, earnPercent, multiplier = 1) => {
  const amount = Number(billAmount);
  const percent = Number(earnPercent);
  const mult = Number(multiplier);

  if (!Number.isFinite(amount) || !Number.isFinite(percent) || !Number.isFinite(mult)) return 0;
  if (amount <= 0 || percent <= 0 || mult <= 0) return 0;

  return Math.round(amount * percent * mult);
};

// centipoints -> the points number the customer actually sees.
const toPoints = (centi) => {
  const value = Number(centi);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value) / CENTI_PER_POINT;
};

// points -> centipoints, for the handful of inbound paths that take a points
// figure from a human (an admin setting a reward's price).
const toCenti = (points) => {
  const value = Number(points);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * CENTI_PER_POINT);
};

module.exports = { CENTI_PER_POINT, earnCenti, toPoints, toCenti };
