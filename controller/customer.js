const path = require('path');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Customer = require('../models/customer');
const User = require('../models/User');
const geocoder = require('../utils/geocoder');

// @desc      Get all customer
// @route     GET /api/v1/customer
// #access    Public
exports.getCustomers = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc      Get single Customer
// @route     GET  /api/v1/cutomer/:id
// @access    Public
exports.getCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findById(req.params.id).populate({
    path: 'perposals',
  });
  // find the user
  const user = await User.findById(customer.user);

  if (!customer) {
    return next(
      new ErrorResponse(
        `Customer not found with the ID of ${req.params.id}`,
        404
      )
    );
  }

  res.status(200).json({
    success: true,
    deta: {
      customer,
      user,
    },
  });
});

// @desc     Create the new customer
// @route    POST /api/v1/customer
// @access   Private
exports.createCutomer = asyncHandler(async (req, res, next) => {
  req.body.user = req.user.id;

  if (req.user.role === 'publisher') {
    return next(new ErrorResponse(`You can not post a job`, 400));
  }

  // Create the customer
  const customer = await Customer.create(req.body);

  res.status(201).json({
    success: true,
    data: customer,
  });
});

// @desc      Update the customer
// @route     PUT /api/v1/customer/:id
// @access    Private
exports.updateCutomer = asyncHandler(async (req, res, next) => {
  let customer = await Customer.findById(req.params.id);

  if (req.user.role === 'publisher') {
    return next(new ErrorResponse(`You can not post a job`, 400));
  }

  if (!customer) {
    return next(
      new ErrorResponse(
        `Customer not found with the ID of ${req.params.id}`,
        404
      )
    );
  }

  customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: customer,
  });
});

// @desc      Delete the customer
// @route     DDELETE /api/v1/customer/:id
// @access    Private
exports.deleteCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findById(req.params.id);

  if (req.user.role === 'publisher') {
    return next(new ErrorResponse(`You can not post a job`, 400));
  }

  if (!customer) {
    return next(
      new ErrorResponse(
        `Customer not found with the ID of ${req.params.id}`,
        404
      )
    );
  }

  await customer.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc      Get customer within a radius
// @route     GET /api/v1/customers/radius/:zipcode/:distance
// @access    Private
exports.getCustomerInRadius = asyncHandler(async (req, res, next) => {
  const { zipcode, distance } = req.params;

  // Get lat/lng from geocoder
  const loc = await geocoder.geocode(zipcode);

  const lat = loc[0].latitude;
  const lng = loc[0].longitude;

  // Calc radius using radians
  // Divide dist by radiud of Earth
  // Earth Radius = 3,963 mi / 6,378 km
  const radius = distance / 3963;

  const custromers = await Customer.find({
    location: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    success: true,
    count: custromers.length,
    data: custromers,
  });
});

// @desc      Upload the pdf file
// @dec       PUT /api/v1/customers/:id/pdf
// @access    Private
exports.uploadPdf = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    return next(new ErrorResponse(`Customer is not found`, 404));
  }

  if (!req.files) {
    return next(new ErrorResponse(`Please upload a file`, 400));
  }

  const file = req.files.file;

  // Make sure the pdf file
  if (!file.mimetype.startsWith('application/pdf')) {
    return next(new ErrorResponse(`Please upload an image file`, 400));
  }
  // Check filesize
  if (file.size > process.env.MAX_FILE_UPLOAD_PDF) {
    return next(
      new ErrorResponse(
        `Please upload an pdf less than ${process.env.MAX_FILE_UPLOAD_PDF}`,
        400
      )
    );
  }

  file.name = `pdf_${req.params.id}${path.parse(file.name).ext}`;

  file.mv(`${process.env.FILE_UPLOAD_PATH_PDF}/${file.name}`, async (err) => {
    if (err) {
      console.error(err);
      return next(new ErrorResponse(`Problem with file upload`, 500));
    }

    await Customer.findByIdAndUpdate(req.params.id, { pdfUrl: file.name });

    res.status(200).json({
      success: true,
      data: file.name,
    });
  });
});

// @desc      Upload the CAD File
// @dec       PUT /api/v1/customers/:id/cad
// @access    Private
exports.uploadCad = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    return next(new ErrorResponse(`Customer is not found`, 404));
  }

  if (!req.files) {
    return next(new ErrorResponse(`Please upload a file`, 400));
  }

  const file = req.files.file;

  // Make sure the pdf file
  if (!file.mimetype.startsWith('image/vnd.dwg')) {
    return next(new ErrorResponse(`Please upload an DWG file`, 400));
  }

  // Check filesize
  if (file.size > process.env.MAX_FILE_UPLOAD_CAD) {
    return next(
      new ErrorResponse(
        `Please upload an image less than ${process.env.MAX_FILE_UPLOAD_CAD}`,
        400
      )
    );
  }

  file.name = `autoCad_${req.params.id}${path.parse(file.name).ext}`;

  file.mv(`${process.env.FILE_UPLOAD_PATH_CAD}/${file.name}`, async (err) => {
    if (err) {
      console.error(err);
      return next(new ErrorResponse(`Problem with file upload`, 500));
    }

    await Customer.findByIdAndUpdate(req.params.id, { catUrl: file.name });

    res.status(200).json({
      success: true,
      data: file.name,
    });
  });
});
