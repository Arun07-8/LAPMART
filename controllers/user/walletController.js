const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");

const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.user;

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return res.render("wallet", {
        user: null,
        transactions: [],
        currentPage: page,
        totalPages: 0,
        balance: 0
      });
    }

    const total = wallet.transactions.length;
    const paginatedTransactions = wallet.transactions
      .sort((a, b) => b.createdAt - a.createdAt)    
      .slice(skip, skip + limit);

    const totalPages = Math.ceil(total / limit);

    const user = await User.findById(userId);

    res.render("wallet", {
      user,
      wallet,
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages,
      balance: wallet.balance
    });

  } catch (error) {
    console.error("The wallet page error: ", error);
    res.redirect("pageNotFound");
  }
};

module.exports = {
  getWalletPage
};

