import Joi from 'joi';
import { Listing } from '../models/Listing.js';

const CATEGORIES = ['textbooks', 'electronics', 'furniture', 'clothing', 'other'];
const CONDITIONS = ['new', 'like-new', 'used', 'worn'];

const createSchema = Joi.object({
  title: Joi.string().trim().required(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid(...CATEGORIES),
  condition: Joi.string().valid(...CONDITIONS),
  seller: Joi.string().hex().length(24)
});

const updateSchema = Joi.object({
  title: Joi.string().trim(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0),
  category: Joi.string().valid(...CATEGORIES),
  condition: Joi.string().valid(...CONDITIONS),
  seller: Joi.string().hex().length(24)
}).min(1);

function publicListing(l) {
  return {
    id: l._id.toString(),
    title: l.title,
    description: l.description,
    price: l.price,
    category: l.category,
    condition: l.condition,
    status: l.status,
    seller: l.seller && l.seller.email
      ? { id: l.seller._id.toString(), name: l.seller.name, email: l.seller.email }
      : l.seller ? l.seller.toString() : null,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt
  };
}

function visible(req) {
  return req.query.includeRemoved === 'true' ? {} : { status: { $ne: 'removed' } };
}

export async function getAllListings(req, res, next) {
  try {
    const listings = await Listing.find(visible(req))
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ listings: listings.map(publicListing) });
  } catch (err) { next(err); }
}

export async function getListing(req, res, next) {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, ...visible(req) })
      .populate('seller', 'name email');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json({ listing: publicListing(listing) });
  } catch (err) { next(err); }
}

export async function createListing(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const listing = await Listing.create(value);
    await listing.populate('seller', 'name email');
    res.status(201).json({ listing: publicListing(listing) });
  } catch (err) { next(err); }
}

export async function updateListing(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const doc = await Listing.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { $set: value },
      { new: true, runValidators: true }
    ).populate('seller', 'name email');
    if (!doc) return res.status(404).json({ message: 'Active listing not found' });
    res.json({ listing: publicListing(doc) });
  } catch (err) { next(err); }
}

export async function markListingSold(req, res, next) {
  try {
    const doc = await Listing.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { $set: { status: 'sold' } },
      { new: true }
    ).populate('seller', 'name email');
    if (!doc) return res.status(404).json({ message: 'Active listing not found' });
    res.json({ listing: publicListing(doc) });
  } catch (err) { next(err); }
}

export async function deleteListing(req, res, next) {
  try {
    const doc = await Listing.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'removed' } },
      { $set: { status: 'removed' } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Listing not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}