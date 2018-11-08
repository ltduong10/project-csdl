const express = require('express')
const passport = require('passport')
const bodyParser = require('body-parser')
const session = require('express-session')
const LocalStrategy = require('passport-local').Strategy
const pg = require('pg')
const flash = require('connect-flash')
const bcrypt = require('bcrypt-nodejs')

const app = express()

app.set('views','./views')
app.set('view engine','ejs')

app.use(flash())
app.use(bodyParser.urlencoded({extended:true}))
app.use(session({
    secret:'thay phuong dep zai',
    cookie:{
        //maxAge:1000*60*5
    }
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(express.static('public'))

var config = {
    user: 'postgres',
    database: 'premiershop',
    password: '011696',
    host: 'localhost',
    port: 5432,
    max: 10,
    idLeTimeouttMillis: 30000,
}

var pool = new pg.Pool(config)

app.get('/check',(req,res)=>{
    res.render('checkout')
})

app.get('/',(req,res)=>{
    if(req.isAuthenticated()){
        res.render('p-index',{usrname:req.user.username})
    }
    else res.render('index')
})

/*app.get('/supreme',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
              const result = await client.query('SELECT * FROM product')
              console.log(result.rows[0].name)
              res.render('list',{product:result})
            } finally {
              client.release()
            }
        })().catch(e => console.log(e.stack))
    }
})*/

app.route('/login')
.get((req,res)=>{
    if(req.isAuthenticated()) res.redirect('/')
    else res.render('login',{message:req.flash('error'),regmessage:req.flash('reg-error')})
})
.post(passport.authenticate('local',{failureRedirect:'/login',successRedirect:'/',failureFlash:true}))

app.get('/logout', (req, res)=>{
    req.logout()
    res.redirect('/')
})

app.post('/register',(req,res)=>{
    (async () => {
        const client = await pool.connect()
        try {
          const result = await client.query("SELECT * FROM customers WHERE username=$1",[req.body.newusername])
          //console.log(res.rows[0])
          if(result.rows[0]){
              req.flash('reg-error','Tài khoản này đã tồn tại')
              res.redirect('/login')
          } else if(req.body.newpassword != req.body.newpasswordagain){
              req.flash('reg-error','Mật khẩu nhập lại không khớp')
              res.redirect('/login')
          } else {
              result1 = await client.query("SELECT * FROM customers WHERE email=$1",[req.body.email])
              if(result1.rows[0]){
                  req.flash('reg-error','Email này đã được sử dụng')
                  res.redirect('/login')
              } else {
                  result2 = await client.query("SELECT * FROM customers WHERE phone=$1",[req.body.phone])
                  if(result2.rows[0]){
                      req.flash('reg-error','Số điện thoại này đã được sử dụng')
                      res.redirect('/login')
                    } else {
                        bcrypt.hash(req.body.newpassword, null, null, function(err, hash) {
                            client.query("INSERT INTO customers(username,password,address,phone,email) VALUES($1,$2,$3,$4,$5)",[req.body.newusername,hash,req.body.address,req.body.phone,req.body.email])
                          });
                        //await client.query("INSERT INTO customers(username,password,address,phone,email) VALUES($1,$2,$3,$4,$5)",[req.body.newusername,req.body.newpassword,req.body.address,req.body.phone,req.body.email])
                    }
                }
            }
        } finally {
             client.release()
         }
         res.render('register')
    })().catch(e =>{
        console.log(e.stack)
    })
})

app.get('/category',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
              const result = await client.query("SELECT * FROM products WHERE productid IN (SELECT product FROM incategory WHERE category = $1)",[req.query.id])
              //console.log(res.rows[0])
              res.render('p-shop',{prod:result,usrname:req.user.username})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('index')
    
})

app.get('/search',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
              const result = await client.query("SELECT * FROM products WHERE upper(productname) LIKE '%'||upper($1)||'%'",[req.query.keywords])
              //console.log(res.rows[0])
              res.render('p-shop',{prod:result,usrname:req.user.username})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('index')
    
})

app.get('/product',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
              const result = await client.query("SELECT * FROM products WHERE productid =$1",[req.query.id])
              //console.log(res.rows[0])
              res.render('p-product-details',{prod:result.rows[0],usrname:req.user.username})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('index')
})

app.get('/addtocart',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                result = await client.query("SELECT * FROM addtocart WHERE customerid = (SELECT userid FROM customers WHERE username = $1) AND productid = $2",[req.user.username,req.query.id])
                if(result.rows[0]) {
                    if(req.query.amnt==-1 && result.rows[0].amount==1){
                        res.redirect('/cart')
                    } else {
                        await client.query("UPDATE addtocart SET amount=amount+$1 WHERE customerid = (SELECT userid FROM customers WHERE username = $2) AND productid = $3",[req.query.amnt,req.user.username,req.query.id])
                        res.redirect('/cart')
                    }
                }
                else {
                    await client.query("INSERT INTO addtocart(customerid,productid,amount) SELECT userid,productid,$1 FROM customers,products WHERE username=$2 AND productid=$3",[req.query.amnt,req.user.username,req.query.id])
                    res.redirect('/cart')
                }
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('index')
})

app.get('/removefromcart',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                await client.query("DELETE FROM addtocart WHERE customerid = (SELECT userid FROM customers WHERE username = $1) AND productid = $2",[req.user.username,req.query.id])
                res.redirect('/cart')
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('index')
})

app.get('/cart',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                result = await client.query("SELECT * FROM products INNER JOIN addtocart ON products.productid = addtocart.productid WHERE addtocart.customerid = (SELECT userid FROM customers WHERE username=$1) ORDER BY products.productid DESC",[req.user.username])
                res.render('p-cart',{prod:result,usrname:req.user.username})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('index')
})

app.get('/addtowishlist',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                result = await client.query("SELECT * FROM products INNER JOIN addtocart ON products.productid = addtocart.productid WHERE addtocart.customerid = (SELECT userid FROM customers WHERE username=$1) ORDER BY products.productid DESC",[req.user.username])
                res.render('p-cart',{prod:result,usrname:req.user.username})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('index')
})


app.get('/wishlist',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                result = await client.query("SELECT * FROM products INNER JOIN addtocart ON products.productid = addtocart.productid WHERE addtocart.customerid = (SELECT userid FROM customers WHERE username=$1) ORDER BY products.productid DESC",[req.user.username])
                res.render('p-cart',{prod:result,usrname:req.user.username})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('index')
})

app.get('/checkout',(req,res)=>{
    res.render('checkout')
})

passport.use(new LocalStrategy(
    (username,password,done)=>{
        (async () => {
            const client = await pool.connect()
            try {
              const result = await client.query("SELECT * FROM customers WHERE username=$1",[username])
              //console.log(res.rows[0])
              if(!result.rows[0]){
                  return done(null,false,{message:'Tài khoản này không tồn tại'})
              } else {
                await bcrypt.compare(password,result.rows[0].password, function(err, res) {
                    if(res) {
                        return done(null,result.rows[0])
                    } else {
                        return done(null,false,{message:'Sai mật khẩu'})
                    } 
                  })
              }
              /*if(result.rows[0]){
                  return done(null,result.rows[0])
              } else{
                  return done(null,false,{message:'Tên tài khoản hoặc mật khẩu không đúng'})
              }*/
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
))

passport.serializeUser((user,done)=>{
    done(null,user.username)
})

passport.deserializeUser((name,done)=>{
    (async () => {
        const client = await pool.connect()
        try {
          const result = await client.query("SELECT * FROM customers WHERE username=$1",[name])
          //console.log(res.rows[0])
          if(result.rows[0]){
            return done(null,result.rows[0])
           } else{
            return done(null,false)
           }
         } finally {
          client.release()
        }
    })().catch(e => {
        console.log(e.stack)
    })
})

const port = 8080
app.listen(port,() => console.log('Server is on!'))