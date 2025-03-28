var msg = "Hello from script"
console.log(msg)
let unusedVar = 123

let unusedFunc = function() {
  console.log("This function is never called")
  console.log("Tdis is a test")
}

function sayHello() {
  console.log("Hello " + "Lint!")
}
sayHello()
