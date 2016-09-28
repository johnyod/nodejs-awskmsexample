
/* http://usejsdoc.org */ 
/* jslint node:true    */
var oracledb = require('oracledb');
var dbConfig = require('./dbconfig.js');
var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var AWS = require('aws-sdk');

var app = express();
var dbpool;
app.set('port', process.env.PORT || 3000);


var keyId = "arn:aws:kms:us-east-1:996476303658:key/7060ddff-4518-4984-8485-83e69d893ed4";
var kms = new AWS.KMS({region:'us-east-1'});

// Use body parser to parse JSON body
app.use(bodyParser.json());


function init()
{	
	//create oracle connection pool
	oracledb.createPool(
		    {
		      user: dbConfig.user,
		      password: dbConfig.password,
		      connectString: dbConfig.connectString,
		      poolMax: 10, // maximum size of the pool
		      poolMin: 0, // let the pool shrink completely
		      poolIncrement: 1, // only grow the pool by one connection at a time
		      poolTimeout: 0  // never terminate idle connections
		    },
		    function(err, pool) {
		      if (err) {
		        console.error("createPool() error: " + err.message);
		        return;
		    }	
           dbpool=pool;  
           // Create HTTP server and listen on port - httpPort			
	         http.createServer(app).listen(app.get('port'), function(){
	           console.log("EMP CRUD server listening on port " + app.get('port'));
	         });
		    }
	  );//end oracledb.createpool
}//end function init

//Http Method: GET
//URI        : /empdata
//Read all the empdata without KMS
//
app.get('/empdata', function (req, res) 
{
 "use strict";
 
    oracledb.getConnection(dbpool,function (err,connection)
    {
	      if (err) 
        {
             // Error connecting to DB
             res.set('Content-Type', 'application/json');
             res.status(500).send(JSON.stringify(
             {
                status: 500,
                message: "Error connecting to DB",
                detailed_message: err.message
             }));
         return;
        }else {
         console.log("GET /empdata : Connection established");
        }
	      connection.execute("SELECT EMPNO, ENAME, JOB, MGR, HIREDATE, SAL, COMM, DEPTNO, dbms_lob.substr(ENAME_ENC) ENAME_ENC FROM EMPENC ORDER BY EMPNO", {},
        {
          outFormat: oracledb.OBJECT // Return the result as Object
        },  function (err, result) 
            {
              if (err) 
              {
                  res.set('Content-Type', 'application/json');
                  res.status(500).send
                  (JSON.stringify
                    (
                      {
                        status: 500,
                        message: "Error getting the user EMP Data",
                        detailed_message: err.message
                      }
                    )
                  );
              } else 
              {
                  console.log("Outside for -"+JSON.stringify(result.rows));
                            
                  for (var i=0; i<result.rows.length;i++)
                  {
                      console.log("Inside For -"+result.rows[i].ENAME_ENC);
                      if((result.rows[i].ENAME_ENC)!=null)
                      {
                          var encdata = {
                             CiphertextBlob: Buffer(result.rows[i].ENAME_ENC, 'base64')
                          };
                          kms.decrypt(encdata,function (err, data) 
                          {
                              if (err) 
                              {
                                 console.log(err, err.stack);
                              }
                              else 
                              {
                                 //console.log('inside dec --empname decrypted');
                                 var DEC_ENAME_ENC = data['Plaintext'].toString();
                                 result.rows[i].ENAME_ENC=DEC_ENAME_ENC;
                                 console.log(DEC_ENAME_ENC +" ---"+result.rows[i].ENAME_ENC);
                                 //res.contentType('application/json').status(200).send(JSON.stringify(result.rows));                               
                              }
                          });//end kms.decrypt
                      }else{
                          //res.contentType('application/json').status(200);
                          //res.send(JSON.stringify(result.rows));
                      }      
                  }//end for
                  res.contentType('application/json').status(200);
                  res.send(JSON.stringify(result.rows));
                  // Release the connection
                  connection.release(
                  function (err) 
                  {
                    if (err) {
                     console.error(err.message);
                    } else {
                     console.log("GET /empdata : Connection released");
                    }
                  }); //end connection.release  
              } //end else
            } // end function(err,result)
        );//end connetion.execute
    }); //oracledb.getConnection
});// end of function(req,res) and app.get
 

//Http method: GET
//URI        : /empdata/:EMPNO
//Read the profile of user given in :EMPNO
app.get('/empdata/:EMPNO', function (req, res) {
 "use strict";

  oracledb.getConnection(dbpool, function (err, connection) 
  {
    if (err) {
         // Error connecting to DB
         res.set('Content-Type', 'application/json');
         res.status(500).send(JSON.stringify({
             status: 500,
             message: "Error connecting to DB",
             detailed_message: err.message
         }));
         return;
     }else {
         console.log("GET /empdata/:EMPNO : Connection established");
    }

    
    connection.execute("SELECT EMPNO, ENAME, JOB, MGR, HIREDATE, SAL, COMM, DEPTNO, dbms_lob.substr(ENAME_ENC) ENAME_ENC FROM EMPENC WHERE EMPNO = :EMPNO", [req.params.EMPNO], 
     {
         outFormat: oracledb.OBJECT // Return the result as Object
     }, function (err, result) 
        {
          if (err || result.rows.length < 1) 
          {
             res.set('Content-Type', 'application/json');
             var status = err ? 500 : 404;
             res.status(status).send(JSON.stringify({
                 status: status,
                 message: err ? "Error getting the empdata" : "empno doesn't exist",
                 detailed_message: err ? err.message : ""
             }));
          } // if 
          else 
          {    	 
        	    //console.log(JSON.stringify(result.rows));
        	    //console.log(result.rows[0].ENAME_ENC);
        	  if((result.rows[0].ENAME_ENC)!=null)
            {
        	     var encdata = {
             		  CiphertextBlob: Buffer(result.rows[0].ENAME_ENC, 'base64')
             		};
               kms.decrypt(encdata,function (err, data) {
               	if (err) {
                       console.log(err, err.stack);
                   }
                   else {
                       //console.log('inside dec --empname decrypted');
                       var DEC_ENAME_ENC = data['Plaintext'].toString();
                       result.rows[0].ENAME_ENC=DEC_ENAME_ENC;
                       //console.log(DEC_ENAME_ENC +" ---"+result.rows[0].ENAME_ENC);
                       res.contentType('application/json').status(200).send(JSON.stringify(result.rows));
                   }
                });//end of kms.decrypt
        	  }else{
                  res.contentType('application/json').status(200).send(JSON.stringify(result.rows));
            }//end of if !=null
                
          }//end of else 
          // Release the connection
          connection.release(
             function (err) 
             {
                 if (err) {
                     console.error(err.message);
                 } else {
                     console.log("GET /empdata/" + req.params.EMPNO + " : Connection released");
                 }
             }
          ); // end connection.release
        }//end function(err, result) 
    );//end connection.execute
  } //end of function (err, connection)
  );//end of oracledb.getconnection 
} //function (req, res)
);//end of app.get

//Http method: POST
//URI        : /empdata
//Creates a new empdata
app.post('/empdata', function (req, res) {
  "use strict";
    if ("application/json" !== req.get('Content-Type')) 
    {
         res.set('Content-Type', 'application/json').status(415).send(JSON.stringify({
         status: 415,
         message: "Wrong content-type. Only application/json is supported",
         detailed_message: null
         }));
     return;
    }//end of if
    
    oracledb.getConnection(dbpool, function (err, connection) 
    {
        if (err) 
        {
         // Error connecting to DB
             res.set('Content-Type', 'application/json').status(500).send(JSON.stringify({
             status: 500,
             message: "Error connecting to DB",
             detailed_message: err.message
             }));
            return;
        }else{
    	    console.log("POST /empdata insert: Connection established");
          
        }// end of if
        
      //kms.encrypt
      var empname = {
                KeyId: keyId,
                Plaintext: req.body.ENAME
              };
      var enc_empname="";    
      kms.encrypt(empname, function (err, data) {
              if (err) {
                  console.log(err, err.stack);
              }
              else {
                    //console.log('inside kms.encrypt encrypted  '+data);
                    
                    enc_empname = data.CiphertextBlob;
                    //console.log(enc_empname);

                        connection.execute("INSERT INTO EMPENC VALUES " +
                         "(:EMPNO, :ENAME, :JOB, :MGR, :HIREDATE, :SAL, :COMM, :DEPTNO, :ENAME_ENC)",   
                        {            
                           EMPNO:    {val:req.body.EMPNO},
                           ENAME:    {val:req.body.ENAME},
                           JOB:      {val:req.body.JOB},
                           MGR:      {val:req.body.MGR},
                           HIREDATE: {val:new Date(req.body.HIREDATE)},
                           SAL:      {val:req.body.SAL},
                           COMM:     {val:req.body.COMM},
                           DEPTNO:   {val:req.body.DEPTNO},
                           ENAME_ENC:{val:enc_empname}
                           
                        },
                        {   
                           autoCommit: true,
                             outFormat: oracledb.OBJECT // Return the result as Object
                        },
                        function (err, result) 
                        {
                              if (err) 
                              {
                                 // Error
                                  res.set('Content-Type', 'application/json');
                                  res.status(400).send(JSON.stringify
                                    (
                                      {
                                       status: 400,
                                       message: err.message.indexOf("ORA-00001") > -1 ? "empno already exists" : "Input Error",
                                       detailed_message: err.message
                                      }
                                    )
                                  );
                              } else {
                                 // Successfully created the resource
                                 res.status(201).set('Location', '/empdata/' + req.body.EMPNO).end();
                              } // end of if(err)
                             // Release the connection
                             connection.release(
                                 function (err) {
                                     if (err) {
                                         console.error(err.message);
                                     } else {
                                         console.log("POST /empdata insert: Connection released");
                                     }
                                 });
                          } //end function(err,result)
                          );//end connection.execute
              }
        });//end of kms.encrypt     
      });//end oracledb.getconnection
} // end function (req, res)
);//end app.post and function


// Http method: DELETE
// URI        : /empdata/:EMPNO
// Delete the empdata for :EMPNO
app.delete('/empdata/:EMPNO', function (req, res) 
{
    "use strict";

        oracledb.getConnection(dbpool, function (err, connection) 
        {
            if (err) 
            {
                // Error connecting to DB
                res.set('Content-Type', 'application/json');
                res.status(500).send
                    (JSON.stringify
                      (
                        {
                           status: 500,
                           message: "Error connecting to DB",
                           detailed_message: err.message
                        }
                      )
                    );
                return;
            }else{
        	      console.log("DELETE /empdata/" + req.params.USER_NAME + " : Connection established");
            }

            connection.execute("DELETE FROM EMPENC WHERE EMPNO = :EMPNO", [req.params.EMPNO], 
            {
              autoCommit: true,
              outFormat: oracledb.OBJECT
            }, 
              function (err, result) 
              {
                if (err || result.rowsAffected === 0) 
                {
                    // Error
                    res.set('Content-Type', 'application/json');
                    res.status(400).send(JSON.stringify({
                       status: 400,
                       message: err ? "Input Error" : "EMPNO doesn't exist",
                       detailed_message: err ? err.message : ""
                    }));
                } else {
                   // Resource successfully deleted. Sending an empty response body. 
                   // res.status(204).end();
                    res.status(204).send(JSON.stringify({
                    status: 204,
                    message: "Resource successfully deleted"
                    })).end();
                }//end if-else
                // Release the connection
                connection.release(
                function (err) 
                {
                    if (err) {
                        console.error(err.message);
                    } else {
                        console.log("DELETE /empdata/" + req.params.USER_NAME + " : Connection released");
                    }
                });//end connection.release
              } //end function(err,result)
            );//end connection.execute
        });//end oracledb.getconnection
});//end function(req,res) and app.delete

// Terminate the process on kill
process
  .on('SIGTERM', function() {
    console.log("\nTerminating");
    process.exit(0);
  })
  .on('SIGINT', function() {
    console.log("\nTerminating");
    process.exit(0);
  });


//initialize the db pool and start server
init();
