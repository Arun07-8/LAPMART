const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error('Global Error:', message);

  if (status === 404) {
    return res.redirect('/pageNotFound'); 
  }

  res.status(status).render('error', {
    title: 'Error',
    status,
    message,
  });
};

module.exports = errorHandler;


