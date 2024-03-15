// function asyncHandler(fn) {

//     return(
//         async function temp(req,res,next){
//             try {
//                 await fn(req,res,next){
                        
//                 }
//             } catch (error) {
                
//             }
//         }
//     )
// }

const asyncHandler = (requestHandler) => (
    (req,res,next) => {
        Promise.resolve(requestHandler(req,res,next))
        .catch((err)=> next(err));
    }
)

export { asyncHandler };