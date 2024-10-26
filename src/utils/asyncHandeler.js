// promise .then .catch style

const asyncHandeler = (requestHandeler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandeler(req, res, next)).catch((error) => {
      res.status(error.status || 500).json({
        success: false,
        message: error.message,
      });
    });
  };
};

// asyncfunction & await style

// const asyncHandeler = (fun = async (req, res, next) => {
//   try {
//     await fun(req, res, next);
//   } catch (error) {
//     res.status(error.status || 500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });

export { asyncHandeler };
