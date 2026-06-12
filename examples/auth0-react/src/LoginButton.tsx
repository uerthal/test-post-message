import { useAuth0 } from "@auth0/auth0-react";

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();
  return (
    <button 
      onClick={() => loginWithRedirect({ authorizationParams: { ui_locales: 'es-MX', prompt: 'consent' } })}
      className="button login"
    >
      Log In
    </button>
  );
};

export default LoginButton;
