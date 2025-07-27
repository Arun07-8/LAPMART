const Address=require("../../models/addressSchema")
const User=require("../../models/userSchema")

//   address Page rendering
const  addressPageload=async (req,res) => {
    try {
        const userId=req.session.user
        const userData=await User.findById(userId)
        const addressDoc = await Address.findOne({ userId });
      if (!addressDoc) {
      return res.render("userAddress", {
        addresses: [],
        message: "No addresses found",
        user: userData,
        currentPage:"address"
      });

    }res.render("userAddress", {
      addresses: addressDoc.address,
      message: null,
      user: userData,
      currentPage:"address"
    });

    } catch (error) {
        console.error("the  add address page not loading",error)
        res.redirect("/pageNotFound")
    }
}

//   address Add Page
const getaddressAddpage=async (req,res) => {
    try {
        const userId=req.session.user
        const userData=await User.findById(userId)
        const fromPage = req.query.from || "";

        res.render("useraddAddress",{user:userData,from: fromPage})
    } catch (error) {
        console.error("the address page not loading",error)
        res.redirect("/pageNotFound")
        
    }
}
const addaddressPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const {
      addressType,
      fullName,
      from,
      phoneNumber,
      alternativePhone,
      city,
      state,
      landmark,
      pincode,
      fullAddress,
      isDefault,
    } = req.body;

    const addressData = {
      addressType,
      name: fullName,
      phone: phoneNumber,
      altPhone: alternativePhone || null,
      city,
      state,
      landmark,
      pincode,
      fullAddress,
      isDefault: isDefault === "true",
    };

    let userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      await Address.create({
        userId,
        address: [{ ...addressData, isDefault: true }],
      });
    } else {
      if (addressData.isDefault) {
        userAddress.address.forEach((addr) => (addr.isDefault = false));
      }
      userAddress.address.push(addressData);
      await userAddress.save();
    }
    if (from === "checkout") {
      return res.status(200).json({
        success: true,
        redirectTo: "/checkout",
        message: "Address added successfully",
      });
    } else {
      return res.status(200).json({
        success: true,
        redirectTo: "/address",
        message: "Address added successfully",
      });
    }
  } catch (error) {
    console.error("Error adding address:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};


// Address edit page
const editAddressPageLoad = async (req, res) => {
  try {
    const userId = req.session.user; 
    const addressId = req.params.addressId; 
    const from = req.query.from || "profile";
    const userData = await User.findById(userId); 

    const addressDoc = await Address.findOne(
      { userId, "address._id": addressId },
      { "address.$": 1 }
    );

    if (!addressDoc || !addressDoc.address[0]) {
      return res.render("editAddress", {
        user: userData,
        address: null,
        message: "Address not found",
        from:from
      });
    }

    res.render("editAddress", {
      user: userData,
      address: addressDoc.address[0],
      message: null,
      from:from
    });

  } catch (error) {
    console.error("Error loading edit address page", error);
    res.redirect("/pageNotFound");
  }
};

const editaddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.addressId;
    const { addressType, fullName, from, phoneNumber, alternativePhone, city, state, landmark, pincode, fullAddress, defaultAddress } = req.body;
    

    let userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      return res.status(404).json({ success: false, message: "No addresses found for this user" });
    }

    const addressToUpdate = userAddress.address.id(addressId);
    if (!addressToUpdate) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    addressToUpdate.addressType = addressType;
    addressToUpdate.name = fullName;
    addressToUpdate.phone = phoneNumber;
    addressToUpdate.altPhone = alternativePhone || null;
    addressToUpdate.city = city;
    addressToUpdate.state = state;
    addressToUpdate.landmark = landmark;
    addressToUpdate.pincode = pincode;
    addressToUpdate.fullAddress = fullAddress;
    addressToUpdate.isDefault = !!defaultAddress;

    if (addressToUpdate.isDefault) {
      userAddress.address.forEach((addr) => {
        if (addr._id.toString() !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    await userAddress.save();
    if (from === "checkout") {
      return res.status(200).json({ success: true, redirectTo: "/checkout" });
    } else {
      return res.status(200).json({ success: true, redirectTo: "/address" });
    }
  } catch (error) {
    console.error("Error editing address:", error);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};


//  Address delete
const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.addressId;

    const result = await Address.updateOne(
      { userId },
      { $pull: { address: { _id: addressId } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Address not found or already deleted' });
    }

    res.status(200).json({ success: true});

  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user; 
    const addressId = req.params.addressId;

    const userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      return res.status(404).json({ success: false, message: "User address not found" });
    }

    const addressToSetDefault = userAddress.address.id(addressId);
    if (!addressToSetDefault) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    // Set selected address as default
    userAddress.address.forEach((addr) => {
      addr.isDefault = (addr._id.toString() === addressId);
    });

    await userAddress.save();

    return res.status(200).json({ success: true, message: "Default address updated successfully" });

  } catch (error) {
    console.error("Error setting default address:", error);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};

module.exports={
    addaddressPage,
    addressPageload,
    getaddressAddpage,
    editAddressPageLoad,
    editaddress,
    deleteAddress,
   setDefaultAddress
}