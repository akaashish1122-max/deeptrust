const { analyzeFakeNews } = require("../services/fakeNewsService");

async function checkClaim(req, res, next) {
  try {
    const claim = String(req.body.claim || req.body.text || "").trim();

    if (!claim) {
      res.status(400);
      throw new Error("Claim is required.");
    }

    const result = await analyzeFakeNews(claim);
    res.status(200).json({
      result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkClaim,
};
