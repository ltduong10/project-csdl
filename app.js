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
    secret:'twice',
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

function checkAdmin(){
    return (req,res,next)=>{
        if(req.isAuthenticated() && req.user.username=='duong10') next()
        else res.redirect('/')
    }
}
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
                        await bcrypt.hash(req.body.newpassword, null, null, function(err, hash) {
                            client.query("INSERT INTO customers(username,password,address,phone,email,fullname) VALUES($1,$2,$3,$4,$5,$6)",[req.body.newusername,hash,req.body.address,req.body.phone,req.body.email,req.body.fullname])
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
              const checker = await client.query("SELECT COUNT(*) FROM products WHERE productid IN (SELECT product FROM incategory WHERE category = $1)",[req.query.id])
              const result = await client.query("SELECT * FROM products WHERE productid IN (SELECT product FROM incategory WHERE category = $1) ORDER BY productname DESC LIMIT 6 OFFSET ($2-1)*6",[req.query.id,req.query.page])
              //console.log(checker.rows[0].count)
              res.render('p-shop',{prod:result,usrname:req.user.username,length:checker.rows[0].count,cat:req.query.id,peji:req.query.page})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
    
})

app.get('/search',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
              const result = await client.query("SELECT * FROM products WHERE upper(productname) LIKE '%'||upper($1)||'%' ORDER BY productname DESC LIMIT 6 OFFSET ($2-1)*6",[req.query.keywords,req.query.page])
              const result2 = await client.query("SELECT COUNT(products.productid) as count FROM products WHERE upper(productname) LIKE '%'||upper($1)||'%'",[req.query.keywords])
              console.log(result2.rows[0].count)
              res.render('p-search',{prod:result,usrname:req.user.username,count:result2.rows[0].count,kw:req.query.keywords,peji:req.query.page})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
    
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
    else res.redirect('/')
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
    else res.redirect('/')
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
    else res.redirect('/')
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
    else res.redirect('/')
})

app.get('/addtowishlist',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                result = await client.query("SELECT * FROM addtowishlist WHERE customerid = (SELECT userid FROM customers WHERE username = $1) AND productid = $2",[req.user.username,req.query.id])
                if(result.rows[0]) {
                    res.redirect('/wishlist')
                }
                else {
                    await client.query("INSERT INTO addtowishlist(customerid,productid) SELECT userid,productid FROM customers,products WHERE username=$1 AND productid=$2",[req.user.username,req.query.id])
                    res.redirect('/wishlist')
                }
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
})

app.get('/wishlist',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                result = await client.query("SELECT * FROM products INNER JOIN addtowishlist ON products.productid = addtowishlist.productid WHERE addtowishlist.customerid = (SELECT userid FROM customers WHERE username=$1) ORDER BY products.productid DESC",[req.user.username])
                
                res.render('p-wishlist',{prod:result,usrname:req.user.username})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
})

app.get('/removefromwishlist',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                await client.query("DELETE FROM addtowishlist WHERE customerid = (SELECT userid FROM customers WHERE username = $1) AND productid = $2",[req.user.username,req.query.id])
                res.redirect('/wishlist')
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.render('/')
})

app.get('/account',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                result = await client.query("SELECT * FROM customers WHERE username = $1",[req.user.username])
                res.render('p-account',{result:result.rows[0],usrname:req.user.username,message:req.flash('update-confirm'),message2:req.flash('change-flash')})
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
})

app.post('/updateinfo',(req,res)=>{
    if(req.isAuthenticated()){
        (async () =>{
            const client = await pool.connect()
            try{
                result = await client.query("UPDATE customers SET address=$1,phone=$2,email=$3,fullname=$4 WHERE username=$5",[req.body.address,req.body.phone,req.body.email,req.body.fullname,req.user.username])
                req.flash('update-confirm','Cập nhật thành công')
                res.redirect('/account')
            } finally {
                client.release()
            }
        })().catch(e=>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
})

app.post('/changepass',(req,res)=>{
    if(req.isAuthenticated()){
        (async ()=>{
            const client = await pool.connect()
            try{
                result = await client.query("SELECT * FROM customers WHERE username = $1",[req.user.username])
                await bcrypt.compare(req.body.oldpass,result.rows[0].password,(err,reslt)=>{
                    if(reslt){
                        if(req.body.newpass == req.body.newpassagain){
                            bcrypt.hash(req.body.newpass, null, null, function(err, hash) {
                                client.query("UPDATE customers SET password = $1 WHERE username = $2",[hash,req.user.username])
                                req.flash('change-flash','Thay đổi thành công')
                                res.redirect('/account')
                              })
                        }
                        else{
                            req.flash('change-flash','Mật khẩu nhập lại không khớp')
                            res.redirect('/account')
                        }
                    }
                    else {
                        req.flash('change-flash','Mật khẩu sai')
                        res.redirect('/account')
                    }
                })
            } finally {
                client.release()
            }
        })().catch(e=>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
})

app.get('/checkout',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
})

app.get('/tesuto',checkAdmin(),(req,res)=>{
    res.render('../public/admin/index')
})
app.get('/confirmorder',(req,res)=>{
    if(req.isAuthenticated()){
        (async () => {
            const client = await pool.connect()
            try {
                await client.query("INSERT INTO orders(customerid,orderdate,orderstatus) SELECT userid,LOCALTIMESTAMP,'new' FROM customers WHERE username = $1",[req.user.username])
                await client.query("INSERT INTO orderdetails SELECT orderid,productid,amount FROM orders,addtocart WHERE orders.customerid = addtocart.customerid AND orders.customerid = (SELECT userid FROM customers WHERE username = $1) AND orderid = (SELECT orderid FROM orders WHERE customerid = (SELECT userid FROM customers WHERE username = $1) ORDER BY orderdate DESC LIMIT 1)",[req.user.username])
                await client.query("DELETE FROM addtocart WHERE customerid = (SELECT userid FROM customers WHERE username = $1)",[req.user.username])
                res.redirect('/cart')
             } finally {
                 client.release()
             }
        })().catch(e =>{
            console.log(e.stack)
        })
    }
    else res.redirect('/')
})

app.get('*',(req,res)=>{
    res.render('404')
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