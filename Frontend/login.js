const loginForm =
    document.getElementById("loginForm");

const loginButton =
    document.getElementById("loginButton");

const loginMessage =
    document.getElementById("loginMessage");


loginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const username =
            document
                .getElementById("username")
                .value
                .trim();

        const password =
            document
                .getElementById("password")
                .value;


        loginMessage.textContent = "";

        loginButton.disabled = true;

        loginButton.textContent =
            "Signing in...";


        try {

            const response =
                await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username,
                            password
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Invalid username or password."
                );
            }


            // Authentication succeeded.
            // The server session is now active.

            window.location.href = "/index.html";


        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            loginMessage.textContent =
                error.message;

            loginMessage.style.color =
                "#b91c1c";


        } finally {

            loginButton.disabled = false;

            loginButton.textContent =
                "Login";
        }

    }
);