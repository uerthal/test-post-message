import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

const Profile = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently, getIdTokenClaims } = useAuth0();
  const [token, setToken] = useState("");
  const [decodedToken, setDecodedToken] = useState<any>(null);
  const [idToken, setIdToken] = useState("");
  const [decodedIdToken, setDecodedIdToken] = useState<any>(null);

  // Helper function to decode JWT
  const parseJwt = (token: string) => {
    try {
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) {
        // Return minimal info for opaque/JWE tokens
        return { isOpaque: true, raw: token };
      }

      const decodePart = (part: string) => {
        try {
          const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          return JSON.parse(jsonPayload);
        } catch (e) {
          return { error: "Failed to decode part" };
        }
      };

      return {
        header: decodePart(parts[0]),
        payload: decodePart(parts[1]),
        signature: parts[2]
      };
    } catch (e) {
      console.error("Error decoding token", e);
      return null;
    }
  };

  useEffect(() => {
    const getTokens = async () => {
      try {
        // Get Access Token
        const accessToken = await getAccessTokenSilently();
        setToken(accessToken);
        setDecodedToken(parseJwt(accessToken));

        // Get ID Token
        const idTokenClaims = await getIdTokenClaims();
        if (idTokenClaims && idTokenClaims.__raw) {
          setIdToken(idTokenClaims.__raw);
          setDecodedIdToken(parseJwt(idTokenClaims.__raw));
        }
      } catch (e) {
        console.error("Error getting tokens", e);
      }
    };
  
    if (isAuthenticated) {
      getTokens();
    }
  }, [getAccessTokenSilently, getIdTokenClaims, isAuthenticated]);

  if (isLoading) {
    return <div className="loading-text">Loading profile...</div>;
  }

  const renderTokenSection = (title: string, rawToken: string, decodedData: any, color: string) => (
    <div style={{ width: '100%', marginTop: '1rem', borderTop: '1px solid #4a5568', paddingTop: '1rem' }}>
      <p style={{ color: color, marginBottom: '0.5rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>{title}</p>
      
      {/* Raw Token */}
      <textarea 
          readOnly
          value={rawToken}
          style={{ 
              width: '100%', 
              height: '80px', 
              padding: '0.5rem', 
              borderRadius: '8px', 
              backgroundColor: '#1a1e27', 
              color: color, 
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              border: '1px solid #4a5568',
              resize: 'none',
              marginBottom: '1rem'
          }} 
          onClick={(e) => e.currentTarget.select()}
      />

      {/* Decoded Data */}
      {decodedData && !decodedData.isOpaque ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Header */}
          <div>
            <p style={{ color: '#fb8b24', marginBottom: '0.2rem', textAlign: 'left', fontWeight: 'bold', fontSize: '0.9rem' }}>Header</p>
            <div style={{ backgroundColor: '#1a1e27', borderRadius: '8px', padding: '0.5rem', border: '1px solid #4a5568', textAlign: 'left', maxHeight: '150px', overflowY: 'auto' }}>
              <pre style={{ color: '#fb8b24', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8rem' }}>
                {JSON.stringify(decodedData.header, null, 2)}
              </pre>
            </div>
          </div>

          {/* Payload */}
          <div>
            <p style={{ color: '#d53f8c', marginBottom: '0.2rem', textAlign: 'left', fontWeight: 'bold', fontSize: '0.9rem' }}>Payload</p>
            <div style={{ backgroundColor: '#1a1e27', borderRadius: '8px', padding: '0.5rem', border: '1px solid #4a5568', textAlign: 'left', maxHeight: '300px', overflowY: 'auto' }}>
              <pre style={{ color: '#d53f8c', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8rem' }}>
                {JSON.stringify(decodedData.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: '#fc8181', textAlign: 'center', fontSize: '0.9rem', fontStyle: 'italic' }}>
          Token is opaque or not a standard JWT (cannot be decoded on client)
        </div>
      )}
    </div>
  );

  return (
    isAuthenticated && user ? (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '1rem', 
        width: '100%',
        maxHeight: '600px',
        overflowY: 'auto',
        paddingRight: '10px' // Avoid scrollbar covering content
      }}>
        <img 
          src={user.picture || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='110' height='110' viewBox='0 0 110 110'%3E%3Ccircle cx='55' cy='55' r='55' fill='%2363b3ed'/%3E%3Cpath d='M55 50c8.28 0 15-6.72 15-15s-6.72-15-15-15-15 6.72-15 15 6.72 15 15 15zm0 7.5c-10 0-30 5.02-30 15v3.75c0 2.07 1.68 3.75 3.75 3.75h52.5c2.07 0 3.75-1.68 3.75-3.75V72.5c0-9.98-20-15-30-15z' fill='%23fff'/%3E%3C/svg%3E`} 
          alt={user.name || 'User'} 
          className="profile-picture"
          style={{ 
            width: '110px', 
            height: '110px', 
            borderRadius: '50%', 
            objectFit: 'cover',
            border: '3px solid #63b3ed'
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='110' height='110' viewBox='0 0 110 110'%3E%3Ccircle cx='55' cy='55' r='55' fill='%2363b3ed'/%3E%3Cpath d='M55 50c8.28 0 15-6.72 15-15s-6.72-15-15-15-15 6.72-15 15 6.72 15 15 15zm0 7.5c-10 0-30 5.02-30 15v3.75c0 2.07 1.68 3.75 3.75 3.75h52.5c2.07 0 3.75-1.68 3.75-3.75V72.5c0-9.98-20-15-30-15z' fill='%23fff'/%3E%3C/svg%3E`;
          }}
        />
        <div style={{ textAlign: 'center' }}>
          <div className="profile-name" style={{ fontSize: '2rem', fontWeight: '600', color: '#f7fafc', marginBottom: '0.5rem' }}>
            {user.name}
          </div>
          <div className="profile-email" style={{ fontSize: '1.15rem', color: '#a0aec0' }}>
            {user.email}
          </div>
        </div>

        {/* Tokens Display Section */}
        <div style={{ width: '100%', marginTop: '1rem' }}>
            {renderTokenSection("Access Token", token, decodedToken, "#68d391")}
            {renderTokenSection("ID Token", idToken, decodedIdToken, "#63b3ed")}
        </div>
      </div>
    ) : null
  );
};

export default Profile;
