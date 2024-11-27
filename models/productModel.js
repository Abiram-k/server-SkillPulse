const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productImage: {
    type: [Array],
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productDescription: {
    type: String,
    required: true
  },
  salesPrice: {
    type: Number,
    required: true
  },
  regularPrice: {
    type: Number,
    required: true
  },
  categoryOffer: {
    type: Number,
    required: false,
    default: 0,
    min: 0,
    max: 100
  },
  offer: {
    type: Number,
    required: false,
    default: 0,
    min: 0,
    max: 100
  },
  ratings: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  isListed: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  units: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    // type: String,
    ref: 'category',
    required: true
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    // type: String,
    ref: 'brand',
  }
}, {
  timestamps: true
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
