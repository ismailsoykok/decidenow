import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import './profile.css';

const Profile = () => {
  const [surveyOptions, setSurveyOptions] = useState([{ text: "", image: null }]);
  const [title, setTitle] = useState("");
  const [surveys, setSurveys] = useState([]);
  const [commentsMap, setCommentsMap] = useState({}); // { surveyId: [yorumlar] }
  const [commentInputs, setCommentInputs] = useState({}); // { surveyId: { firstname, lastname, text } }
  const [loadingComments, setLoadingComments] = useState({})

  // Kullanıcı bilgileri (userId dahil)
  const [user, setUser] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    dob: ''
  });

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

  const handleDeleteSurvey = async (surveyId) => {
  const confirmDelete = window.confirm("Bu anketi silmek istediğinizden emin misiniz?");
  if (!confirmDelete) return;

  try {
    await axios.delete(`http://localhost:5000/api/surveys/${surveyId}`);
    // Anket listesinden sil
    setSurveys(prev => prev.filter(s => s._id !== surveyId));
  } catch (error) {
    console.error("Anket silme hatası:", error);
    alert("Anket silinirken bir hata oluştu.");
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
  console.log("Yorum yapılırken gönderilen ad soyad:", user);


  try {
    const newCommentData = {
      surveyId,
      firstname: user.firstName,
      lastname: user.lastName,
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

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    // Token'ı decode et ve kullanıcı ID'sini al
    const decoded = jwtDecode(token);
    const userId = decoded.id;
    

    // userId'yi kaydet
    setUser(prev => ({ ...prev, id: userId }));

    // Kullanıcı bilgilerini çek
    axios.get(`http://localhost:5000/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(response => {
        const data = response.data;
        setUser(prev => ({
          ...prev,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          dob: new Date(data.dob).toLocaleDateString()
        }));
      })
      .catch(err => {
        console.error("Kullanıcı bilgisi alınamadı", err);
      });
  }, []);

  const handleOptionChange = (index, value) => {
    const updatedOptions = [...surveyOptions];
    updatedOptions[index].text = value;
    setSurveyOptions(updatedOptions);
  };

  const handleImageChange = (index, event) => {
    const updatedOptions = [...surveyOptions];
    updatedOptions[index].image = event.target.files[0];
    setSurveyOptions(updatedOptions);
  };

  const addOption = () => {
    setSurveyOptions([...surveyOptions, { text: "", image: null }]);
  };

  const removeOption = () => {
    if (surveyOptions.length > 1) {
      setSurveyOptions(surveyOptions.slice(0, -1));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append('title', title);
    formData.append('userId', user.id); 
    formData.append('firstName', user.firstName);
    formData.append('lastName', user.lastName); // 🔹 Kullanıcı ID'yi ekle

    surveyOptions.forEach((option, index) => {
      formData.append(`options[${index}][text]`, option.text);
      if (option.image) {
        formData.append(`options[${index}][image]`, option.image);
      }
    });

    try {
      const response = await axios.post('http://localhost:5000/api/surveys', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('Survey successfully submitted:', response.data);
      setTitle('');
      setSurveyOptions([{ text: "", image: null }]);
    } catch (error) {
      console.error('Survey submission failed:', error);
    }
  };

  const handleVote = async (surveyId, optionIndex) => {
  const token = localStorage.getItem('userToken');
  if (!token) {
    alert('Please log in to vote.');
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
    alert(error.response.data.message || 'An error occurred while voting.');
  }
};

  return (
    <div className="profile-container">
      <Navbar />
      <div className="profile-header">
        <br />
        <h1>{user.firstName}</h1>
        <h1>{user.lastName}</h1>
        <p className="email">{user.email}</p>
        <p className="dob">{user.dob}</p>
      </div>

      <div className="survey-section">
        <h2>Yeni Anket Oluştur</h2>
        <form className="survey-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Anket Başlığı"
            className="survey-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="options">
            {surveyOptions.map((option, index) => (
              <div key={index} className="option-input-container">
                <input
                  type="text"
                  value={option.text}
                  placeholder={`Seçenek ${index + 1}`}
                  className="survey-input"
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                />
                <div className="image-upload-container">
                  <label htmlFor={`file-upload-${index}`} className="image-upload-label">
                    <i className="bi bi-camera"></i>
                  </label>
                  <input
                    type="file"
                    id={`file-upload-${index}`}
                    accept="image/*"
                    className="image-upload-input"
                    onChange={(e) => handleImageChange(index, e)}
                  />
                  {option.image && (
                    <img
                      src={URL.createObjectURL(option.image)}
                      alt="Yüklenen Fotoğraf"
                      className="uploaded-image"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="option-buttons">
            <button type="button" className="option-btn" onClick={addOption}>AAAAAAAAAAAA</button>
            <button type="button" className="option-btn" onClick={removeOption}>-</button>
          </div>
          <button type="submit" className="survey-submit">Anketi Paylaş</button>
        </form>
      </div>



            <div className="feed">
              <h2>Anketlerim</h2>
  {surveys.length === 0 ? (
    <p>Yükleniyor veya anket yok.</p>
  ) : (
    surveys
      .filter(survey => survey.userId === user.id) // Sadece kullanıcının anketleri
      .map((survey) => (
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
              const hasVoted = votes.some(vote => vote.userId === user.id);

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
          <button
  onClick={() => handleDeleteSurvey(survey._id)}
  style={{
    position: 'absolute',
    top: '8px',
    right: '8px',
    backgroundColor: '#ff4d4f',
    color: 'white',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    zIndex: 10,
  }}
>
  Sil
</button>


          {/* Yorumlar kısmı */}
          <div className="comments" style={{ marginTop: '20px' }}>
            <h4>Yorumlar</h4>

            {loadingComments[survey._id] ? (
              <p>Yorumlar yükleniyor...</p>
            ) : (
              <>
                {commentsMap[survey._id] && commentsMap[survey._id].length > 0 ? (
                  commentsMap[survey._id].map(comment => (
                    <div
                      key={comment._id}
                      style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '6px' }}
                    >
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

            {/* Yorum yazma formu */}
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




    </div>
  );
};

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="logo">DecideNow</div>
      <div className="navbar-icons">
        <i className="bi bi-person-circle profile-icon"></i>
      </div>
    </nav>
  );
};

export default Profile;
