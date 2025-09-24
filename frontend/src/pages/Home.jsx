import React from "react";
import { useEffect, useState } from "react";
import './style.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import ReCAPTCHA from "react-google-recaptcha";

export function Home() {
  
  const [surveys, setSurveys] = useState([]);
  const [statusMessage, setStatusMessage] = useState(""); 
  const [tercih, setTercih] = useState(null);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    email: "",
    password: ""
  });
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '' });
  const [captchaValue, setCaptchaValue] = useState(null);


  const [commentsMap, setCommentsMap] = useState({}); // { surveyId: [yorumlar] }
  const [commentInputs, setCommentInputs] = useState({}); // { surveyId: { firstname, lastname, text } }
  const [loadingComments, setLoadingComments] = useState({})
const [searchTerm, setSearchTerm] = useState("");
const filteredSurveys = surveys.filter((survey) =>
  survey.title.toLowerCase().includes(searchTerm.toLowerCase())
);

const popularSurveys = [...surveys]
  .map(s => ({
    ...s,
    voteCount: (s.votes || []).length
  }))
  .sort((a, b) => b.voteCount - a.voteCount)
  .slice(0, 5);

  const navigate = useNavigate();

  

  useEffect(() => {
  const token = localStorage.getItem('userToken');
  if (token) {
    fetchUserInfo();
    setTercih('profile');
  }
}, []);


  // Handle login functionality
  const HandleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://localhost:5000/login", loginData);
      


      if (response.status === 200) {
        localStorage.setItem('userToken', response.data.token); // Store token in localStorage
        setStatusMessage("Giriş başarılı!");
        setTercih('profile'); // Switch to profile view after successful login
      } else {
        setStatusMessage("Giriş hatası: " + response.data.message);
      }
    } catch (error) {
      console.error("Login error:", error);
      setStatusMessage("Bir hata oluştu.");
    }
  };
  

  // Handle registration functionality
  const HandleRegister = async (e) => {
    e.preventDefault();

    if (!captchaValue) {
      setStatusMessage('Lütfen CAPTCHA doğrulamasını tamamlayın!');
      return;  // CAPTCHA yoksa işlem yapma
    }

    try {
      // captchaValue'yu backend'e de gönderiyoruz
      const response = await axios.post('http://localhost:5000/register', {
        ...registerData,
        captcha: captchaValue,
      });

      if (response.status === 201) {
        localStorage.setItem('userToken', response.data.token);
        setStatusMessage("Kayıt başarılı!");
        setTercih('profile');
      } else {
        setStatusMessage("Kayıt hatası: " + response.data.message);
      }
    } catch (error) {
      console.error("Register error:", error);
      setStatusMessage("Bir hata oluştu.");
    }
  };


  
  useEffect(() => {
  const token = localStorage.getItem('userToken');
  if (token) {
    const decoded = jwtDecode(token);
    console.log("Decoded token:", decoded);
    setUserInfo({
      firstName: decoded.firstName || decoded.firstname || decoded.name || "",
      lastName: decoded.lastName || decoded.lastname || "",
    });
    setTercih('profile');
  }
  console.log("Token değeri:", token);
}, []);


  const handleLogout = () => {
    localStorage.removeItem('userToken'); 
    setTercih(null); 
  };

  useEffect(() => {
 
    
    // Anketleri getir
    const fetchSurveys = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/surveys");
        console.log(response.data);
        if (response.status === 200) {
          setSurveys(response.data); // response.data array olmalı
        } else {
          console.error("Anketler alınamadı");
        }
      } catch (error) {
        console.error("Anket çekme hatası:", error);
      }
    };

    fetchSurveys();
  }, []);

 const fetchUserInfo = async () => {
  try {
    const token = localStorage.getItem('userToken');
    if (!token) return;

    // Token'dan userId çıkar
    const decoded = jwtDecode(token);
    const userId = decoded.id;

    const response = await axios.get(`http://localhost:5000/api/users/${userId}`);

    if (response.status === 200) {
      setUserInfo({
        firstName: response.data.firstName,
        lastName: response.data.lastName,
      });
    }
  } catch (error) {
    console.error("Kullanıcı bilgisi çekilemedi", error);
  }
};

useEffect(() => {
  if (surveys.length > 0) {
    surveys.forEach(survey => {
      fetchComments(survey._id);
    });
  }
}, [surveys]);




  


  const fetchComments = async (surveyId) => {
    setLoadingComments(prev => ({ ...prev, [surveyId]: true }));
    try {
      const response = await axios.get(`http://localhost:5000/api/comments/${surveyId}`);
      if (response.status === 200) {
        setCommentsMap(prev => ({ ...prev, [surveyId]: response.data }));
      } else {
        console.error("Yorumlar alınamadı");
      }
    } catch (error) {
      console.error("Yorum çekme hatası:", error);
    } finally {
      setLoadingComments(prev => ({ ...prev, [surveyId]: false }));
    }
  };

  // Yorum form inputlarını güncelle
 const handleCommentInputChange = (surveyId, field, value) => {
  if (field !== "text") return; // sadece 'text' alanını güncelle
  setCommentInputs(prev => ({
    ...prev,
    [surveyId]: {
      ...prev[surveyId],
      text: value
    }
  }));
};


  // Yorum gönderme fonksiyonu
 const handleSubmitComment = async (surveyId) => {
  const input = commentInputs[surveyId];
  if (!input || !input.text) {
    alert("Lütfen yorum alanını doldurun.");
    return;
  }
  console.log("Yorum yapılırken gönderilen ad soyad:", userInfo);


  try {
    const newCommentData = {
      surveyId,
      firstname: userInfo.firstName,
      lastname: userInfo.lastName,
      text: input.text,
    };
    console.log("Gönderilen yorum verisi:", newCommentData);


    const response = await axios.post("http://localhost:5000/comments", newCommentData);
    if (response.status === 201) {
      // Yeni yorumu yorumlar listesine ekle
      setCommentsMap(prev => ({
        ...prev,
        [surveyId]: [response.data, ...(prev[surveyId] || [])]
      }));

      // Formu temizle
      setCommentInputs(prev => ({
        ...prev,
        [surveyId]: { text: "" }
      }));
    } else {
      alert("Yorum eklenemedi.");
    }
  } catch (error) {
    console.error("Yorum gönderme hatası:", error);
    alert("Yorum gönderirken bir hata oluştu.");
  }
};
const handleVote = async (surveyId, optionIndex) => {
  const token = localStorage.getItem('userToken');
  if (!token) {
    alert('Kayıt olunuz.');
    return;
  }

  const decoded = jwtDecode(token);
  const userId = decoded.id;

  try {
    const response = await axios.post(`http://localhost:5000/api/surveys/${surveyId}/vote`, {
      userId,
      optionIndex,
    });

    if (response.status === 200) {
      // Update the local state to reflect the new vote
      setSurveys(prevSurveys =>
        prevSurveys.map(survey =>
          survey._id === surveyId
            ? {
                ...survey,
                votes: [...survey.votes, { userId, optionIndex }],
              }
            : survey
        )
      );
    }
  } catch (error) {
    alert(error.response.data.message || 'Zaten bu ankette bir oy kullandınız..');
  }
};




return (
  <div className="container">
    <div className="navbar">
      <h1 className="logo">DecideNow</h1>
      <div className="buttons">
        {tercih === "profile" ? (
          <>
            <Link to="/profile"><button className="button">Profil</button></Link>
            <button className="button" onClick={handleLogout}>Çıkış Yap</button>
          </>
        ) : (
          <>
            <button className="button" onClick={() => setTercih("login")}>Giriş Yap</button>
            <button className="button" onClick={() => setTercih("register")}>Kayıt Ol</button>
          </>
        )}
      </div>
    </div>

    {tercih === "login" ? (
      <div className="login">
        <form onSubmit={HandleLogin}>
          <div>
            <label htmlFor="email">Email:</label>
            <input type="email" id="email" name="email" required value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="password">Şifre:</label>
            <input type="password" id="password" name="password" required value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
          </div>
          <button type="submit">Giriş Yap</button>
          <button type="button" style={{ background: 'transparent' }} onClick={() => setTercih(null)}>
            <i className="bi bi-x-circle" style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', color: 'black' }}></i>
          </button>
        </form>
        <div className="state">
          {statusMessage && <p>{statusMessage}</p>}
        </div>
      </div>
    ) : tercih === "register" ? (
      <div className="register">
        <h2>Kayıt Ol</h2>
        <form onSubmit={HandleRegister}>
          <div>
            <label htmlFor="firstName">İsim:</label>
            <input type="text" id="firstName" name="firstName" required value={registerData.firstName} onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })} />
          </div>
          <div>
            <label htmlFor="lastName">Soyisim:</label>
            <input type="text" id="lastName" name="lastName" required value={registerData.lastName} onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })} />
          </div>
          <div>
            <label htmlFor="dob">Doğum Tarihi:</label>
            <input type="date" id="dob" name="dob" required value={registerData.dob} onChange={(e) => setRegisterData({ ...registerData, dob: e.target.value })} />
          </div>
          <div>
            <label htmlFor="email">Email:</label>
            <input type="email" id="email" name="email" required value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="password">Şifre:</label>
            <input type="password" id="password" name="password" required value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} />
          </div>
          <ReCAPTCHA
            sitekey="6LfmbFArAAAAAIFmsEcWg11jiPhTYhaG3_S_eNzA"
            onChange={(value) => setCaptchaValue(value)}
          />
          <button type="submit">Kayıt Ol</button>
          <button type="button" style={{ background: 'transparent' }} onClick={() => setTercih(null)}>
            <i className="bi bi-x-circle" style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', color: 'black' }}></i>
          </button>
        </form>
        <div className="state">
          <p>{statusMessage}</p>
        </div>
      </div>
    ) : null}

   
    <div className="search-bar" style={{ margin: '20px 0', textAlign: 'center' }}>
      <input
        type="text"
        placeholder="Anket ara..."
        
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: '60%',
          padding: '10px',
          fontSize: '1rem',
          borderRadius: '8px',
          border: '1px solid #ccc'
        }}
      />
    </div>

    <div className="main-content">
      <div className="left-sidebar">
        <h2>Menü</h2>
        <ul>
          <li>Anketler</li>
          <li>Hakkında</li>
          <li>Ayarlar</li>
        </ul>
      </div>

      <div className="feed">
        {filteredSurveys.length === 0 ? (
          <p>Yükleniyor, eşleşen anket yok veya anket yok.</p>
        ) : (
          filteredSurveys.map((survey) => (
            <div key={survey._id} className="survey" style={{ position: 'relative', paddingBottom: '40px' }}>
              <h3>{survey.title}</h3>
              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  fontSize: '0.85rem',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontWeight: '500',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {survey.firstName} {survey.lastName}
              </div>

              <div className="options">
                {survey.options.map((option, index) => {
                  const votes = survey.votes || [];
                  const voteCount = votes.filter(vote => vote.optionIndex === index).length;
                  const hasVoted = votes.some(vote => vote.userId === userInfo.id);

                  return (
                    <div key={index}>
                      <button
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: 'none',
                          backgroundColor: hasVoted ? '#e0e0e0' : '#f5f5f5',
                          cursor: hasVoted ? 'not-allowed' : 'pointer',
                          borderRadius: '6px',
                          marginBottom: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                        onClick={() => !hasVoted && handleVote(survey._id, index)}
                        disabled={hasVoted}
                      >
                        <span style={{ fontWeight: '600', marginBottom: '8px' }}>
                          {option.text} - {voteCount} oy
                        </span>
                        {option.image && (
                          <img
                            src={`data:image/png;base64,${option.image}`}
                            alt={option.text}
                            style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px' }}
                          />
                        )}
                      </button>
                      {index !== survey.options.length - 1 && (
                        <hr style={{ border: '0.5px solid #ddd', margin: '6px 0' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="comments" style={{ marginTop: '20px' }}>
                <h4>Yorumlar</h4>
                {loadingComments[survey._id] ? (
                  <p>Yorumlar yükleniyor...</p>
                ) : (
                  <>
                    {commentsMap[survey._id] && commentsMap[survey._id].length > 0 ? (
                      commentsMap[survey._id].map(comment => (
                        <div key={comment._id} style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '6px' }}>
                          <strong>{comment.firstname} {comment.lastname}</strong>
                          <p>{comment.text}</p>
                          <small style={{ color: 'gray' }}>{new Date(comment.createdAt).toLocaleString()}</small>
                        </div>
                      ))
                    ) : (
                      <p>Henüz yorum yok.</p>
                    )}
                  </>
                )}
                <div style={{ marginTop: '10px' }}>
                  <textarea
                    placeholder="Yorumunuzu yazın..."
                    value={(commentInputs[survey._id]?.text) || ""}
                    onChange={(e) => handleCommentInputChange(survey._id, 'text', e.target.value)}
                    style={{ width: '100%', marginTop: '10px', padding: '6px' }}
                    rows={3}
                  />
                  <button
                    className="submit-comment"
                    onClick={() => handleSubmitComment(survey._id)}
                    style={{ marginTop: '6px' }}
                  >
                    Yorum Yap
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="right-sidebar">
  <h2>Popüler Anketler</h2>
  <div>
    {popularSurveys.map((survey) => (
      <button
        key={survey._id}
        onClick={() => setSearchTerm(survey.title)}
        className="popular-button"
      >
        {survey.title}
      </button>
    ))}
  </div>
</div>



    </div>
  </div>
);
}

export default Home;