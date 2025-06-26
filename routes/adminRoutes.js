const express = require('express');
const router = express.Router();

const adminController = require("../controller/admin/customerController");
const adminOrderController = require("../controller/admin/orderController")
const adminCouponController = require("../controller/admin/couponController")
const adminProductController = require("../controller/admin/productController")
const adminCategoryController = require("../controller/admin/categoryController")

const adminBrandController = require("../controller/admin/brandController")
const bannerController = require("../controller/user/bannerController");

const { uploadImage } = require("../Middleware/multer")
const { verifyAdmin } = require("../Middleware/adminAuth");
const { pagination } = require('../Middleware/pagination');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');

router.post("/adminLogin", adminController.login);
router.post("/logout", verifyAdmin, adminController.logout);

// user 
router.get("/customers", verifyAdmin, adminController.customers);
router.get("/block/:id", verifyAdmin, adminController.blockUser);

// product

router.get("/product", pagination(Product), adminProductController.getProduct);
router.post("/product", uploadImage.array("file"), verifyAdmin, adminProductController.addProduct);
router.put("/product/:id", uploadImage.array("file"), verifyAdmin, adminProductController.editProduct);
router.patch("/productListing/:id", verifyAdmin, adminProductController.handleProductListing);
router.patch("/productRestore/:id", verifyAdmin, adminProductController.restoreProduct);
router.delete("/product/:id", verifyAdmin, adminProductController.deleteProduct);

// category

router.get("/category", verifyAdmin, adminCategoryController.getCategory)
router.post("/category", uploadImage.single("file"), verifyAdmin, adminCategoryController.addCategory);
router.put("/category", uploadImage.single("file"), verifyAdmin, adminCategoryController.editCategory);
router.patch("/categoryRestore/:id", verifyAdmin, adminCategoryController.categoryRestore);
router.patch("/categoryListing/:id", verifyAdmin, adminCategoryController.listCategory);
router.delete("/category/:id", verifyAdmin, adminCategoryController.deleteCategory);

// banner

router.get("/banner", bannerController.getBanner);
router.post("/banner", uploadImage.single("file"), verifyAdmin, bannerController.addBanner);
router.patch("/bannerListing/:id", verifyAdmin, bannerController.listBanner);
router.delete("/banner/:id", verifyAdmin, bannerController.deleteBanner);

//brand

router.get("/brand", adminBrandController.getBrand)
router.post("/brand", uploadImage.single("file"), verifyAdmin, adminBrandController.addBrand);
router.put("/brand", uploadImage.single("file"), verifyAdmin, adminBrandController.editBrand);
router.patch("/brandRestore/:id", verifyAdmin, adminBrandController.brandRestore);
router.patch("/brandListing/:id", verifyAdmin, adminBrandController.listBrand)
router.delete("/brand/:id", verifyAdmin, adminBrandController.deleteBrand);

// order

router.get("/order", verifyAdmin, adminOrderController.getOrder);
router.get("/return-requests",verifyAdmin,adminOrderController.getReturnRequests)
router.get("/recentSales", verifyAdmin, adminOrderController.getAllOrders);
router.patch("/status", verifyAdmin, adminOrderController.editStatus);
router.patch("/returnProduct", verifyAdmin, adminOrderController.returnOrder);
 
// coupon

router.get("/coupon", verifyAdmin, adminCouponController.getCoupons)
router.post("/coupon", verifyAdmin, adminCouponController.addCoupons)
router.delete("/coupon/:id", verifyAdmin, adminCouponController.deleteCoupon)



module.exports = router; 