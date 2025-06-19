const crypto = require("crypto");

function verifySignature(orderId, paymentId, signature, secret) {
    const generated = crypto
      .createHmac("sha256", secret)
      .update(orderId + "|" + paymentId)
      .digest("hex");

    return generated === signature;
}

module.exports = { verifySignature };
