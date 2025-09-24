console.log("Server started...");
require("dotenv").config(); // EN ÜSTTE OLMALI
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const app = express();
const jwt = require('jsonwebtoken');

app.use(cors());
app.use(express.json());

// MongoDB Bağlantısı
mongoose
  .connect("mongodb://127.0.0.1:27017/decidenow", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB'ye bağlandı"))
  .catch((err) => {
    console.error("MongoDB bağlantı hatası:", err);
    process.exit(1); // Bağlantı hatası durumunda server'ı sonlandır
  });

// Kullanıcı Şeması ve Modeli
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  dob: Date,
  email: { type: String, unique: true },
  password: String,
});

const User = mongoose.model("User", UserSchema);

// Anket Şeması ve Modeli
const SurveySchema = new mongoose.Schema({
  title: String,
  options: [
    {
      text: String,
      image: { type: Buffer },
      voteCount: { type: Number, default: 0 }
    }
  ],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firstName: String,
  lastName: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  votes: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      optionIndex: { type: Number, required: true }
    }
  ]
});


const Survey = mongoose.model("Survey", SurveySchema);



// Multer ile dosya yükleme işlemi
const storage = multer.memoryStorage(); // Dosyaları bellek üzerinde tutuyoruz, disk yerine
const upload = multer({ storage: storage });

// Kayıt İşlemi
// KAYIT
const JWT_SECRET = process.env.JWT_SECRET;

app.post("/register", async (req, res) => {
  
  try {
    const { firstName, lastName, dob, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Bu email adresi ile daha önce kayıt olmuş." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ firstName, lastName, dob, email, password: hashedPassword });
    await newUser.save();

    // Token üret
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 🔥 DİKKAT: TOKEN'ı response içinde gönderiyoruz
    res.status(201).json({
      message: "Kayıt başarılı!",
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName
      }
    });
  } catch (error) {
    console.error("Kayıt hatası:", error);
    res.status(500).json({ error: "Kayıt işlemi başarısız!", details: error.message });
  }
});


// GİRİŞ
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        // Token üret
        const token = jwt.sign(
          { id: user._id, email: user.email },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        // 🔥 Yine token'ı cevapla gönderiyoruz
        res.status(200).json({
          message: "Giriş başarılı!",
          token,
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName
          }
        });
      } else {
        res.status(400).json({ error: "Hatalı şifre!" });
      }
    } else {
      res.status(400).json({ error: "Hatalı email adresi!" });
    }
  } catch (error) {
    console.error("Giriş hatası:", error);
    res.status(500).json({ error: "Sunucu hatası!", details: error.message });
  }
});

// Anket Oluşturma Endpointi
app.post("/api/surveys", upload.any(), async (req, res) => {
  try {
    const { title, options, userId, firstName, lastName } = req.body;

    // Eğer frontend options'ı JSON.stringify ile gönderiyorsa parse et:
    const parsedOptions = typeof options === "string" ? JSON.parse(options) : options;

    // options içine voteCount ekliyoruz, başlangıç 0
    const surveyOptions = parsedOptions.map((option, index) => {
      const image = req.files && req.files[index] ? req.files[index].buffer : null;
      return {
        text: option.text,
        image: image,
        voteCount: 0
      };
    });

    const newSurvey = new Survey({
      title,
      options: surveyOptions,
      userId,
      firstName,
      lastName,
      createdAt: new Date(),
      votes: []  // Burada votes dizisini boş olarak başlatıyoruz
    });

    await newSurvey.save();

    res.status(201).json({ message: 'Anket başarıyla oluşturuldu!', survey: newSurvey });
  } catch (error) {
    console.error('Anket oluşturma hatası:', error);
    res.status(500).json({
      error: 'Anket oluşturulamadı',
      details: error.message,
    });
  }
});








// GET /api/users/:id
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

app.get('/api/surveys', async (req, res) => {
  try {
    const surveys = await Survey.find().sort({ createdAt: -1 });

    const surveysForClient = surveys.map(survey => ({
      _id: survey._id,
      title: survey.title,
      options: survey.options.map(option => ({
        text: option.text,
        image: option.image ? option.image.toString('base64') : null,
        voteCount: option.voteCount || 0
      })),
      userId: survey.userId,
      firstName: survey.firstName,
      lastName: survey.lastName,
      createdAt: survey.createdAt,
      votes: survey.votes || []  // votes dizisini burada da gönderiyoruz
    }));

    res.json(surveysForClient);
  } catch (error) {
    console.error("Anketleri çekerken hata oluştu:", error);
    res.status(500).json({ error: "Anketler getirilemedi." });
  }
});





const commentSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Comment = mongoose.model("Comments", commentSchema);


app.post('/comments', async (req, res) => {
  const { surveyId, firstname, lastname, text } = req.body;

  if (!surveyId || !firstname || !lastname || !text) {
    return res.status(400).json({ message: 'surveyId, firstname, lastname ve text zorunludur' });
  }

  try {
    const newComment = new Comment({ surveyId, firstname, lastname, text });
    await newComment.save();
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Yorum ekleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

app.get('/api/comments/:surveyId', async (req, res) => {
  const { surveyId } = req.params;

  try {
    const comments = await Comment.find({ surveyId }).sort({ createdAt: -1 });
    res.status(200).json(comments);
  } catch (error) {
    console.error('Yorumları çekme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});


app.post('/api/surveys/:surveyId/vote', async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { userId, optionIndex } = req.body;

    if (typeof optionIndex !== 'number') {
      return res.status(400).json({ error: 'optionIndex sayısal bir değer olmalı' });
    }

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ error: 'Anket bulunamadı' });
    }

    // Kullanıcı daha önce oy verdi mi kontrolü
    const hasVoted = survey.votes.some(vote => vote.userId.toString() === userId);
    if (hasVoted) {
      return res.status(400).json({ error: 'Bu anket için zaten oy kullandınız' });
    }

    // Seçenek index geçerli mi kontrol et
    if (optionIndex < 0 || optionIndex >= survey.options.length) {
      return res.status(400).json({ error: 'Geçersiz seçenek indeksi' });
    }

    // Oy sayısını arttır
    survey.options[optionIndex].voteCount += 1;

    // Oy veren kullanıcıyı votes dizisine ekle
    survey.votes.push({ userId, optionIndex });

    // Kaydet
    await survey.save();

    res.json({ message: 'Oy verildi', survey });
  } catch (error) {
    console.error('Oy verme hatası:', error);
    res.status(500).json({ error: 'Oy verilemedi' });
  }
});


app.get('/api/surveys/:id', async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey) return res.status(404).json({ message: 'Not found' });

    // Calculate vote counts
    const voteCounts = survey.options.map((_, index) => {
      return survey.votes.filter(v => v.optionIndex === index).length;
    });

    res.status(200).json({ ...survey.toObject(), voteCounts });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching survey' });
  }
});

app.get('/api/my-surveys/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: 'userId gerekli.' });
    }

    const surveys = await Survey.find({ userId });

    res.status(200).json(surveys);
  } catch (error) {
    console.error('Kullanıcının anketleri alınırken hata:', error);
    res.status(500).json({ message: 'Anketler alınamadı.' });
  }
});

app.delete('/api/surveys/:id', async (req, res) => {
   try {
    const survey = await Survey.findByIdAndDelete(req.params.id);
    if (!survey) return res.status(404).json({ message: 'Anket bulunamadı.' });

    res.status(200).json({ message: 'Anket silindi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
});


// Sunucuyu Başlat
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('Server ${PORT} portunda çalışıyor');
});