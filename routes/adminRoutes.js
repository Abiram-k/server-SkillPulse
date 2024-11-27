const express = require('express');
const router = express.Router();
const adminController = require("../controller/adminController");
const bannerController = require("../controller/bannerController");
const { uploadImage } = require("../Middleware/multer")
const { verifyAdmin } = require("../Middleware/adminAuth");

router.post("/adminLogin", adminController.login);

router.get("/customers", verifyAdmin, adminController.customers);
router.get("/block/:id", verifyAdmin, adminController.blockUser);

router.get("/product", adminController.getProduct);
router.post("/product", uploadImage.array("file"), verifyAdmin, adminController.addProduct);
router.put("/product/:id", uploadImage.array("file"), verifyAdmin, adminController.editProduct);
router.patch("/productListing/:id", verifyAdmin, adminController.handleProductListing);
router.patch("/productRestore/:id", verifyAdmin, adminController.restoreProduct);
router.delete("/product/:id", verifyAdmin, adminController.deleteProduct);

router.get("/category", verifyAdmin, adminController.getCategory)
router.post("/category", uploadImage.single("file"), verifyAdmin, adminController.addCategory);
router.put("/category", uploadImage.single("file"), verifyAdmin, adminController.editCategory);
router.patch("/categoryRestore/:id", verifyAdmin, adminController.categoryRestore);
router.patch("/categoryListing/:id", verifyAdmin, adminController.listCategory);
router.delete("/category/:id", verifyAdmin, adminController.deleteCategory);

router.get("/banner", bannerController.getBanner);
router.post("/banner", uploadImage.single("file"), verifyAdmin, bannerController.addBanner);
router.patch("/brandListing/:id", verifyAdmin, bannerController.listBanner);
router.delete("/banner/:id", verifyAdmin, bannerController.deleteBanner);

router.get("/brand", adminController.getBrand)
router.post("/brand", uploadImage.single("file"), verifyAdmin, adminController.addBrand);
router.put("/brand", uploadImage.single("file"), verifyAdmin, adminController.editBrand);
router.patch("/brandRestore/:id", verifyAdmin, adminController.brandRestore);
router.patch("/brandListing/:id", verifyAdmin, adminController.listBrand)
router.delete("/brand/:id", verifyAdmin, adminController.deleteBrand);

router.patch("/status", adminController.editStatus);
router.get("/order", adminController.getOrder);
router.patch("/returnProduct", verifyAdmin, adminController.returnOrder);


router.get("/coupon", adminController.getCoupons)
router.post("/coupon", adminController.addCoupons)
router.delete("/coupon/:id", adminController.deleteCoupon)

router.get("/recentSales", adminController.getAllOrders)


module.exports = router; 