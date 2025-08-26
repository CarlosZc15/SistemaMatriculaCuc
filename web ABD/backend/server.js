const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const session = require("express-session");
const bodyParser = require("body-parser");

const app = express();
const cors = require("cors");
app.use(cors());
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "s3cr3tKey",
    resave: false,
    saveUninitialized: true,
  })
);

// Conexión a Railway
const db = mysql.createConnection({
  host: "gondola.proxy.rlwy.net",
  user: "root",
  password: "NmteugxQsSndlTGVVPiuHnlynOMHiirX",
  database: "railway",
  port: 30088,
});

db.connect((err) => {
  if (err) {
    console.error("Error de conexión:", err);
    return;
  }
  console.log("Conectado a MySQL en Railway ✅");
});

/* ------------------- RUTAS ------------------- */

// Registro de usuario
app.post("/register", async (req, res) => {
  try {
    const data = req.body;
    console.log("Datos recibidos:", data);

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Insertar en usuarios
    const sqlUsuarios =
      "INSERT INTO usuarios (correo, password, rol) VALUES (?, ?, ?)";
    db.query(
      sqlUsuarios,
      [data.Correo, hashedPassword, data.rol],
      (err, result) => {
        if (err) {
          console.error("Error al insertar en usuarios:", err);
          return res.status(500).send("Error en usuarios");
        }

        const userId = result.insertId;

        if (data.rol === "estudiante") {
          const sqlEstudiante = `
            INSERT INTO Estudiante 
            (Id_usuario, Carnet, Nombre, Apellidos, FechaNacimiento, Direccion, Telefono, Correo, Id_carrera, Contra) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          db.query(
            sqlEstudiante,
            [
              userId, // Id_usuario
              data.Carnet,
              data.Nombre,
              data.Apellidos,
              data.FechaNacimiento,
              data.Direccion,
              data.Telefono,
              data.Correo,
              data.Id_carrera,
              hashedPassword, // ✅ guardamos encriptado
            ],
            (err2) => {
              if (err2) {
                console.error("Error al insertar en Estudiante:", err2);
                return res.status(500).send("Error en Estudiante");
              }
              res.send("✅ Estudiante registrado con éxito");
            }
          );
        } else if (data.rol === "profesor") {
          const sqlProfesor = `
            INSERT INTO Profesor (Id_usuario, Carnet, Nombre, Apellido, FechaNacimiento, Direccion, Telefono, Correo, Especializacion, Contra)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            sqlProfesor,
            [
              userId,
              data.Carnet,
              data.Nombre,
              data.Apellidos,
              data.FechaNacimiento,
              data.Direccion,
              data.Telefono,
              data.Correo,
              data.Especializacion,
              hashedPassword,
            ],
            (err3) => {
              if (err3) {
                console.error("❌ Error al insertar en Profesor:", err3);
                return res.status(500).send("Error en Profesor");
              }
              res.send("✅ Profesor registrado con éxito");
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).send("Error en servidor");
  }
});

// Login de usuario
app.post("/login", (req, res) => {
  const { correo, password } = req.body;

  db.query(
    "SELECT * FROM usuarios WHERE correo = ?",
    [correo],
    async (err, results) => {
      if (err) return res.status(500).send("Error en la base de datos");

      if (results.length === 0) {
        return res.status(401).send("Usuario no encontrado ❌");
      }

      const user = results[0];
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).send("Contraseña incorrecta ❌");
      }

      // 🔹 Guardar en la sesión
      req.session.id_usuario = user.id_usuario;
      req.session.rol = user.rol;

      // Dependiendo del rol, buscar datos extra
      if (user.rol === "estudiante") {
        db.query(
          "SELECT Nombre, Apellidos, Carnet, Telefono, Direccion FROM Estudiante WHERE id_usuario = ?",
          [user.id_usuario],
          (err, estResults) => {
            if (err) return res.status(500).send("Error en la base de datos");

            const est = estResults[0] || {};
            res.json({
              mensaje: "Login exitoso ✅",
              id: user.id_usuario,
              nombre: est.Nombre,
              apellido: est.Apellidos,
              carnet: est.Carnet,
              telefono: est.Telefono,
              direccion: est.Direccion,
              rol: user.rol,
              correo: user.correo,
            });
          }
        );
      } else if (user.rol === "profesor") {
        db.query(
          "SELECT Nombre, Apellido, Carnet, Telefono, Direccion FROM Profesor WHERE id_usuario = ?",
          [user.id_usuario],
          (err, profResults) => {
            if (err) return res.status(500).send("Error en la base de datos");

            const prof = profResults[0] || {};
            res.json({
              mensaje: "Login exitoso ✅",
              id: user.id_usuario,
              nombre: prof.Nombre,
              apellido: prof.Apellido,
              carnet: prof.Carnet,
              telefono: prof.Telefono,
              direccion: prof.Direccion,
              rol: user.rol,
              correo: user.correo,
            });
          }
        );
      } else {
        res.json({
          mensaje: "Login exitoso ✅",
          id: user.id_usuario,
          rol: user.rol,
          correo: user.correo,
        });
      }
    }
  );
});

//-----------------RUTA PARA ACTUALIZAR ESTUDIANTE-----------------------
app.put("/api/estudiante/actualizar", (req, res) => {
  const { id_usuario, telefono, direccion } = req.body;

  if (!id_usuario) {
    return res.status(400).json({ error: "Falta id_usuario" });
  }

  db.query(
    "UPDATE Estudiante SET Telefono = ?, Direccion = ? WHERE id_usuario = ?",
    [telefono, direccion, id_usuario],
    (err, result) => {
      if (err) {
        console.error("Error al actualizar:", err);
        return res.status(500).json({ error: "Error en la base de datos" });
      }
      res.json({ mensaje: "Datos actualizados correctamente ✅" });
    }
  );
});

// ----------------OBTENER DATOS DEL USUARIO LOGUEADO-------------------
app.get("/api/datos-personales", (req, res) => {
  const idUsuario = req.session.id_usuario;
  const rol = req.session.rol;

  if (!idUsuario) {
    return res.status(401).json({ error: "No autenticado" });
  }

  let query = "";
  if (rol === "estudiante") {
    query = `
      SELECT e.Carnet, e.Nombre, e.Apellidos, e.Telefono, e.Correo, e.Direccion 
      FROM Estudiante e 
      WHERE e.id_usuario = ?`;
  } else if (rol === "profesor") {
    query = `
      SELECT p.Carnet, p.Nombre, p.Apellido, p.Telefono, p.Correo, p.Direccion 
      FROM Profesor p 
      WHERE p.id_usuario = ?`;
  } else {
    return res.status(400).json({ error: "Rol no válido" });
  }

  db.query(query, [idUsuario], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0)
      return res.status(404).json({ error: "Datos no encontrados" });
    res.json(results[0]);
  });
});

// Ruta para actualizar datos personales
// Guardar/actualizar datos (sirve para estudiante y profesor)
app.post("/api/guardar-datos", (req, res) => {
  const { id, id_usuario, rol, telefono, direccion } = req.body;

  // Tomamos el id que venga (body o sesión)
  const userId = id_usuario || id || req.session.id_usuario;
  if (!userId) {
    return res.status(400).json({ success: false, mensaje: "id_usuario requerido" });
  }

  // Rol en minúsculas; por defecto estudiante
  const role = (rol || req.session.rol || "estudiante").toLowerCase();

  // Whitelist de tablas según rol real de tu esquema
  const table = role === "profesor" ? "Profesor" : "Estudiante";

  const sql = `UPDATE ${table} SET Telefono = ?, Direccion = ? WHERE id_usuario = ?`;

  // 👈 Usa SIEMPRE `db.query`
  db.query(sql, [telefono || null, direccion || null, userId], (err, result) => {
    if (err) {
      console.error("❌ Error al actualizar:", err);
      return res.status(500).json({ success: false, mensaje: "Error en la base de datos" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: `${table} no encontrado` });
    }
    res.json({ success: true, mensaje: "Datos guardados correctamente ✅" });
  });
});


// ------------------ OBTENER MATERIAS DE TI ------------------
app.get("/materias/ti", (req, res) => {
  const sql = `
    SELECT Id_Materia, Nom_Materia, Requisito, Creditos, Cupos 
    FROM Materia 
    WHERE IDCarrera = 1
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error al obtener materias:", err);
      return res.status(500).json({ error: "Error en la base de datos" });
    }
    res.json(results);
  });
});

// ------------------ PREMATRICULAR (rebajar cupo) ------------------
app.post("/prematricular", (req, res) => {
  const { idMateria } = req.body;

  if (!idMateria) {
    return res.status(400).json({ error: "Falta idMateria" });
  }

  const sql = `
    UPDATE Materia 
    SET Cupos = Cupos - 1 
    WHERE Id_Materia = ? AND Cupos > 0
  `;

  db.query(sql, [idMateria], (err, result) => {
    if (err) {
      console.error("❌ Error en prematrícula:", err);
      return res.status(500).json({ error: "Error en la base de datos" });
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: "No hay cupos disponibles" });
    }

    res.json({ success: true, mensaje: "✅ Prematrícula realizada con éxito" });
  });
});


// Endpoint para obtener carreras
app.get('/carreras', (req, res) => {
  const sql = 'SELECT Id_carrera, Nom_carrera FROM Carrera';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});


// ------------------ OBTENER MATERIAS POR CARRERA (SP) ------------------
app.get("/api/materias/:idCarrera", (req, res) => {
  const idCarrera = Number(req.params.idCarrera);

  if (!Number.isInteger(idCarrera)) {
    return res.status(400).json({ error: "idCarrera inválido" });
  }

  //Llamada al procedimiento almacenado
  const sql = "CALL ObtenerMateriasPorCarrera(?)";

  db.query(sql, [idCarrera], (err, results) => {
    if (err) {
      console.error("❌ Error al llamar el SP:", err);
      return res.status(500).json({ error: "Error en la base de datos" });
    }

    const rows = (results && results[0]) ? results[0] : [];

    return res.json(rows);
  });
});

//--------------RUTA CONFIRMACION DE MATRICULA--------------------
app.post("/api/confirmar-matricula", (req, res) => {
  const { carnet, materias } = req.body;
  console.log("Datos recibidos:", carnet, materias);

  if (!carnet || !materias || materias.length === 0) {
    return res.status(400).json({ message: "Datos incompletos" });
  }

  // Simulación de inserción
  res.json({ message: "Matrícula confirmada con éxito" });
});

// -------------- RUTA FORMALIZACIÓN DE PAGO --------------------
app.post("/api/formalizar-pago", (req, res) => {
  const { carnet, materias, pago } = req.body;
  console.log("📌 Formalización recibida:", carnet, materias, pago);

  if (!carnet || !materias || materias.length === 0 || !pago) {
    return res.status(400).json({ message: "Datos incompletos" });
  }

  res.json({ message: "Pago realizado y matrícula formalizada ✅" });
});



/* ------------------- ARRANCAR SERVIDOR ------------------- */
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Cerrar sesión
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.send("Sesión cerrada correctamente 🚪");
});

