const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const mongoose = require("mongoose");
const { seedDB } = require("./seeds");

app.use(cors());
app.use(express.json());

const userRoutes = require("./routes/userRoutes");

app.use("/users", userRoutes);

app.get("/", (req, res) => {
  res.send("HPTQ API");
});

// mongoose
//   .connect(process.env.MONG_URI)
//   // .then(() => {
//   //     seedDB()
//   // })
//   .then(() => {
//     server.listen(PORT, () => {
//       console.log("Connected to db & listening at port " + PORT);
//     });
//   })
//   .catch((error) => {
//     console.log(error);
//   });

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const users = [];
let rooms = [];
// let activeRooms = [];
let usersInCurrentRoom;
let currentRoom;
let count = 0;

io.on("connection", (socket) => {
  // console.log("user conneted", socket.id);

  const getUsersInRoom = (room) => {
    return users.filter((user) => user.room === room);
  };

  // const checkUsersInRoom = () => {
  //   if (usersInCurrentRoom.length === 2) {
  //     console.log("THERE ARE 5 USERS IN THE ROOM");
  //   }
  // };

  const getUsersAfterDisconnect = (room, id) => {
    return users.filter((user) => user.room === room && user.id !== id);
  };

  socket.on("send_message", (data, room) => {
    console.log(room);
    socket.to(room).emit("recieved_message", data, socket.id);
    console.log(data);
  });

  socket.on("set_all_other_turns_false", (room) => {
    socket.broadcast.to(room).emit("make_all_other_turns_false");
  });

  socket.on("send_canvas", (data, room) => {
    socket.to(room).emit("recieved_canvas", data);
    socket.to(room).emit("recieved_id", socket.id);
  });

  socket.on("refresh_canvas", (data, room) => {
    socket.to(room).emit("refreshed_canvas", data);
  });

  socket.on("send_time_up", (room) => {
    console.log("************************************");
    console.log("************************************");
    console.log("count:", count);
    console.log("************************************");
    console.log("************************************");

    console.log("send time up", room);
    // socket.to(room).emit("receive_time_up")
    currentRoom = room;
    usersInCurrentRoom = getUsersInRoom(currentRoom);
    usersInCurrentRoom.forEach((user, i) => {
      // console.log('start of for each', user, i, count)
      if (i === count) {
        user.active = true;
        io.to(room).emit("recieve_active_player", user);
      } else {
        user.active = false;
      }
      console.log("inside for each", user.username, "i", i, user.active);
    });

    if (count < usersInCurrentRoom.length - 1) {
      count++;
    } else {
      count = 0;
    }

    // console.log('user in current room', usersInCurrentRoom)
    io.to(room).emit("receive_time_up", usersInCurrentRoom);
    socket.to(room).emit("make_all_other_turns_false");
  });

  socket.on("join_room", (player, room) => {
    console.log("join roo player:", player);
    users.push(player);
    player.id = socket.id;
    currentRoom = room;
    usersInCurrentRoom = getUsersInRoom(currentRoom);

    io.to(room).emit("player_data", player);

    usersInCurrentRoom.forEach((element, i) => {
      if (i >= 1) {
        element.host = false;
      }
    });

    console.log("users in current room:", usersInCurrentRoom);
    // console.log(`users currently in room ${room}:`);
    if (!rooms.find((obj) => obj.roomNumber == room)) {
      rooms.push({
        roomNumber: room,
        players: usersInCurrentRoom,
        gameState: false,
      });
    }

    console.log("all rooms:", rooms);

    for (let i = rooms.length - 1; i >= 0; i--) {
      console.log("room it is looping through currently:", rooms[i]);
      if (rooms[i].gameState == false) {
        if (usersInCurrentRoom.length <= 4) {
          socket.join(room);
          console.log(`user ${player.username} joined room ${room}`);
          io.to(room).emit("room_data", usersInCurrentRoom);

          socket.emit("accept_connection");
          return;
        } else {
          console.log("CONNECTION REFUSED!");
          socket.emit("refuse_connection");
        }
      }

      if (rooms[i].gameState == true) {
        socket.emit("refuse_connection");
      }
    }
  });

  socket.on("start_game", (room) => {
    rooms = rooms.filter((obj) => obj.roomNumber == room);
    rooms.forEach((room) => (room.gameState = true));
    socket.to(room).emit("redirect_start_game", room);
  });

  socket.on("disconnect", () => {
    usersAfterDisconnect = getUsersAfterDisconnect(currentRoom, socket.id);
    // console.log("Users after disc:", usersAfterDisconnect);
    // io.to(currentRoom).emit("room_data", usersAfterDisconnect);
  });
});

server.listen(PORT, () => {
  console.log("Connected to db & listening at port " + PORT);
});
