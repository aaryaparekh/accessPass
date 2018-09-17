const express = require('express');
const bodyParser = require('body-parser');
const _=require('lodash');
const moment = require('moment');
moment().format();

//import local stuff
//require the mongoose config files
var {mongoose} = require('./db/mongoose.js');
const {ObjectID} = require('mongodb');
//load in models
var {User} = require('./models/user');
var {Teacher} = require('./models/teacher');
var {Schedule} = require('./models/schedules2018-2019');
//middlewear
var {authenticate} = require('./middlewear/authenticate');
var {authenticateTeacher} = require('./middlewear/authenticateTeacher')
//express into variable so we can make changes to it
var app = express();
app.use(bodyParser.json()); //config middlewear for express
app.use(express.static(__dirname+'/htmlFiles')); //config middlewear for express

//CORS FOR LOCAL TESTING
var cors = require('cors');
app.use(cors({credentials:true, origin:true}));
//variable to hold the port
const port = process.env.PORT || 3000 || 8000 || 8080;

//For testing purposes
app.post('/test', (req, res)=>{
  res.status(200).send(getNextDate(4));
});

//Define pages u want to render
app.get('/', (req, res) => {
  res.sendFile(__dirname+'/htmlFiles/index.html');
});

// app.get('/*', (req, res)=>{
//   res.sendFile(__dirname+'/htmlFiles/index.html');
// })

app.get('/login', (req, res) => {
  res.sendFile(__dirname+'/htmlFiles/loginRedirect.html');
});

app.get('/loginStudent', (req, res)=>{
  res.sendFile(__dirname+'/htmlFiles/login.html');
});

app.get('/loginTeachers', (req, res)=>{
  res.sendFile(__dirname+'/htmlFiles/loginTeachers.html');
});

app.get('/register', (req, res)=>{
  res.sendFile(__dirname+'/htmlFiles/registerRedirect.html');
});

app.get('/registerStudent', (req, res)=>{
  res.sendFile(__dirname+'/htmlFiles/register.html');
});

app.get('/registerTeachers', (req, res)=>{
  res.sendFile(__dirname+'/htmlFiles/registerTeachers.html');
});

app.get('/loadPortal', authenticate, (req, res)=>{
    res.sendFile(__dirname+'/htmlFiles/portal.html');
});

app.get('/loadPortalTeachers', authenticateTeacher, (req, res)=>{
  res.sendFile(__dirname+'/htmlFiles/portalTeachers.html');
});

//Registering new student
app.post('/users/registerNew', (req, res)=>{
  var body = _.pick(req.body, ['firstName','lastName', 'email', 'password']);

  if(!body.firstName || !body.lastName || !body.email || !body.password)
    res.status(400).send();

  var user = new User(body);

  user.save().then(()=>{
    return user.generateAuthToken();
  }).then((token)=>{
    res.header('x-auth', token).send(user);
  }).catch((e)=>{
    console.log("something didnt go right");
    res.status(400).send(e);
  });
});

//Registering new teacher
app.post('/teachers/registerNew', (req, res)=>{
  var body = _.pick(req.body, ['firstName', 'lastName', 'email', 'password']);
  var teacher = new Teacher(body);
  console.log("Teacher", teacher);
  teacher.save().then(()=>{
    return teacher.generateAuthToken();
    console.log("Generated token")
  }).then((token)=>{
    res.header('x-auth', token).send(teacher);
  }).catch((e)=>{
    res.status(400).send(e);
  });
});

//Logging in for student
app.post('/users/login', (req, res)=>{
  var body = _.pick(req.body, ['email', 'password']);
  console.log("Attemting login with username: "+body.email+" and password "+body.password);
  User.findByCredentials(body.email, body.password).then((user)=>{
    console.log("Found user " +user);
    return user.generateAuthToken().then((token)=>{
      res.header('x-auth', token).status(200).send({'authHeader': token});
    });
  }).catch((e)=>{
    console.log("ERROR: "+e);
    res.status(400).send();
  });
});

//Loggin in for teachers
app.post('/teachers/login', (req, res)=>{
  var body = _.pick(req.body, ['email', 'password']);

  Teacher.findByCredentials(body.email, body.password).then((teacher)=>{
    return teacher.generateAuthToken().then((token)=>{
      res.header('x-auth', token).status(200).send({'authHeader': token});
    });
  }).catch((e)=>{
    res.status(400).send();
  });
});

//Logging out for students
app.delete('/users/logOut', authenticate, (req, res)=>{
  req.user.removeToken(req.token).then(()=>{
    res.status(200).send();
  }, ()=>{
    res.status(400).send();
  });
});

//loggin out for Teacher
app.delete('/teachers/logOut', authenticateTeacher, (req, res)=>{
  req.teacher.removeToken(req.token).then(()=>{
    res.status(200).send();
  }, ()=>{
    res.status(400).send();
  });
});

//Get Student info: name, and if scheduled access for thursday and wednesday.
app.get('/users/getInfo', authenticate, (req, res)=>{
  var wednesday;
  var thursday;
  var wedID;
  var thuID;
  Schedule.findOne({
      date: getNextDate(3),
      students: req.user._id
  }).then((schedule1)=>{
    if(!schedule1){
      wednesday = false;
    }else{
      wednesday = true;
      wedID = schedule1.teacherID;
    }

    Schedule.findOne({
      date: getNextDate(4),
      students: req.user._id
    }).then((schedule2)=>{
      if(!schedule2){
        thursday = false;
      }else{
        thursday = true;
        thuID = schedule2.teacherID;
      }

      res.send({"name":req.user.firstName, "wednesday":wednesday, "thursday":thursday, "wednesdayTeacherID":wedID,"thursdayTeacherID":thuID});
    })
  });

});

//Get student's Teachers
app.get('/users/getTeachers', authenticate, (req, res)=>{
    var teachers = req.user.getTeachers();
    console.log(teachers);
    res.status(200).send(teachers);
});

//Get teachers names given the array of Teacher IDs in student's doc.
app.get('/users/getTeachersNames', authenticate, (req, res)=>{
  var teacherIDs = req.user.getTeachers();
  var names = [];

  var returnedNames = new Promise((resolve, reject)=>{
    for(var x = teacherIDs.length; x>0; x--){
      console.log("running for loop w/ teachers at "+(x-1)+" being "+teacherIDs [x-1]);
      Teacher.getTeacherName(teacherIDs[x-1]).then((name)=>{
        var fullName = name.firstName + " " + name.lastName;
        names.push(fullName);
        console.log("Names is now", names);
      }, ()=>{
        console.log("rejecting promise");
        reject();
      });
    }
    setTimeout(() => resolve(), 1000);     //MIGHT WANNA FIX THIS, STOP USING TIMEOUTS
  });

  returnedNames.then(()=>{
    console.log("Names ended as", names);
    res.status(200).send({"names":names,"teacherIDs":teacherIDs});
  }, ()=>{
    res.status(400).send();
  });
});

//get the name of a teacher given their id
app.post('/users/getOneTeacherName', authenticate, (req, res)=>{
    var body = _.pick(req.body, ['teacherID']);
    return Teacher.getTeacherName(body.teacherID).then((name)=>{
      res.status(200).send(name.firstName + " " + name.lastName);
    }, (error)=>{
      console.log(error);
      res.status(400).send("Something went wrong...");
    })
});

//getTeachersNames
app.get('/teachers/getName', authenticateTeacher, (req, res)=>{
  console.log(req.teacher.name);
  res.send(req.teacher.firstName + " " + req.teacher.lastName);
});

//generate signUpKey for Teachers
app.post('/teachers/generateSignUpToken', authenticateTeacher, (req, res)=>{
  req.teacher.generateSignUpKey().then((key)=>{
    res.status(200).send(key);
  }, ()=>{
    res.status(400).send();
  });
});

//add student to schedules2018-2019
//Takes a body of teacherID, date, and the student must be logged in.
//FOR DATE VAR, 3 = WEDNESDAY, 4= THURSDAY
app.post('/schedule/addStudent', authenticate, (req, res)=>{
  var requestData = _.pick(req.body, ['teacherID', 'date']);
  //Find Schedule
  Schedule.findSchedule(requestData.teacherID, getNextDate(requestData.date)).then((schedule)=>{
      if(schedule.students.length){
        index = schedule.students.indexOf(req.user._id);
        if(index == -1)
          schedule.students.push(req.user._id);
      } else {
        schedule.students.push(req.user._id);
      }
      schedule.save().then(()=>{
         res.status(200).send(schedule);
       });
    }, ()=>{
    return new Schedule({
      date: getNextDate(requestData.date),                    //CHANGE THIS TO ADD DATE BASED ON WHAT USER SELECTS
      teacherID: requestData.teacherID,
      students: [req.user._id]
    }).save().then((schedule)=>{
      res.status(200).send(schedule);
    });

    res.status(400).send();
  });

});

//Return students that are part of a schedule given teacher id and day
//day = 3 is wed, day = 4 is thur
app.get('/schedule/getSchedule', authenticateTeacher, (req, res)=>{
  var wednesdayStudents = [];
  var thursdayStudents = [];
  //Wednesay
  Schedule.findOne({
    date: getNextDate(3),
    teacherID:req.teacher._id
  }).then((schedule)=>{
    if(!schedule){
      console.log("no schedule wednesday");
      wednesdayStudents.push("No Students Signed Up");
    }else{
      console.log("wednesday Schedule found");
      for(var x = schedule.students.length; x>0; x--){
        User.findOne({
          _id:schedule.students[x-1]
        }).then((student)=>{
          wednesdayStudents.push(student.firstName + " " + student.lastName);
        }, (error)=>{
          console.log("something wrong with getting student names");
        });
      }
    }
  }, (error)=>{
    console.log("Some error");
    res.status(400).send();
  });

  //thursday
  Schedule.findOne({
    date: getNextDate(4),
    teacherID:req.teacher._id
  }).then((schedule)=>{
    if(!schedule){
      console.log("no schedule thursday");
      thursdayStudents.push("No Students Signed Up");
    }else{
      console.log("thursday Schedule found");
      for(var x = schedule.students.length; x>0; x--){
        User.findOne({
          _id:schedule.students[x-1]
        }).then((student)=>{
          thursdayStudents.push(student.firstName + " " + student.lastName);
        }, (error)=>{
          console.log("something wrong with getting student names");
        });
      }
    }
  }, (error)=>{
    console.log("Some error");
    res.status(400).send();
  });

  setTimeout(() => res.status(200).send({"wednesdayStudents":wednesdayStudents, "thursdayStudents":thursdayStudents}), 2000);

});

app.post('/checkIfStudentIsInSchedule', authenticate, (req, res)=>{
  var body = _.pick(req.body, ['teacherID', 'date']);
  Schedule.checkIfStudentIsInSchedule(body.teacherID, body.date, req.user._id).then((schedule)=>{
    if(schedule){
      res.status(200).send(true);
    }
  }, ()=>{
    res.status(200).send(false);
  });
})

//Add teacher with email
app.post('/addTeacher', authenticate, (req, res)=>{
  var body = _.pick(req.body, ['teacherEmail']);
  req.user.addTeacher(body.teacherEmail).then((savedUser)=>{
    res.status(200).send(savedUser);
  }, ()=>{
    res.status(400).send();
  });
});

app.get('/getNextDate', (req, res)=>{
  var dates = [];
  dates.push(getNextDate(3));
  dates.push(getNextDate(4));
  setTimeout(() => res.status(200).send(dates), 1000);
});

//Date Generation. Using Moment.js API.
var getNextDate = function(day){ //day being 0 for sunday 6 for saturday
  if(moment().day()>day){
    var date = moment().day(day+7);
    var formatedDate = date.format("dddd, MMMM Do YYYY");
  }else{
    var date = moment().day(day);
    var formatedDate = date.format("dddd, MMMM Do YYYY");
  }
  return formatedDate;
}

app.listen(port, ()=>{
  console.log(`Started server on port ${port}`);
});

module.exports = {app};
