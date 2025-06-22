
    const sessionData = document.getElementById('session-data');
    console.log(sessionData);
    
        let sessionMessage = sessionData.dataset.message;
   
        if (sessionMessage !== 'null') {
            try {
                sessionMessage = JSON.parse(sessionMessage);
            } catch (error) {
                console.error("Failed to parse sessionMessage:", error);
            }
        } else {
            sessionMessage = null;
        }
     
                document.addEventListener("DOMContentLoaded", function () {
                    if (typeof Swal === 'undefined') {
                        console.error("SweetAlert2 not loaded");
                        return;
                    }

                
                    if (sessionMessage) {
                        let text, icon, title;
                        if (typeof sessionMessage === 'string') {
                            text = sessionMessage;
                            icon = 'error';
                            title = 'Error';
                        } else if (sessionMessage && sessionMessage.text) {
                            text = sessionMessage.text;
                            icon = sessionMessage.type === 'success' ? 'success' : 'error';
                            title = sessionMessage.type === 'success' ? 'Success' : 'Error';
                        }
                        if (text) {
                            Swal.fire({
                                icon: icon,
                                title: title,
                                text: text,
                                confirmButtonColor: '#3a7bd5'
                            });
                        }
                    }
                })

        function togglePassword() {
            const passwordInput = document.getElementById('password');
            const toggleIcon = document.getElementById('togglePassword');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('bi-eye');
                toggleIcon.classList.add('bi-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('bi-eye-slash');
                toggleIcon.classList.add('bi-eye');
            }
        }
        document.addEventListener("DOMContentLoaded", function () {
            const email = document.getElementById("email");
            const password = document.getElementById("password");
            const error1 = document.querySelector(".error1");
            const error2 = document.querySelector(".error2");
            const signupForm = document.querySelector("form");

            function showError(errorElement, message) {
                errorElement.style.display = "block";
                errorElement.innerHTML = message;
            }

            function hideError(errorElement) {
                errorElement.style.display = "none";
                errorElement.innerHTML = "";
            }

            function emailValidateChecking() {
                const emailVal = email.value.trim();
                const emailpattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailVal) {
                    showError(error1, "Email cannot be empty");
                    return false;
                } else if (!emailpattern.test(emailVal)) {
                    showError(error1, "Invalid email format");
                    return false;
                } else {
                    hideError(error1);
                    return true;
                }
            }

            function passwordValidateChecking() {
                const passwordVal = password.value.trim();
                const strongpass = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
                let isValid = true;

                if (!passwordVal) {
                    showError(error2, "Password cannot be empty");
                    isValid = false;
                } else if (passwordVal.length < 8) {
                    showError(error2, "Should contain at least 8 characters");
                    isValid = false;
                } else if (!strongpass.test(passwordVal)) {
                    showError(error2, "Password must include at least one number and one special character (@$!%*?&).");
                    isValid = false;
                } else {
                    hideError(error2);
                }

                return isValid;
            }

            email.addEventListener("input", emailValidateChecking);
            password.addEventListener("input", passwordValidateChecking);

            signupForm.addEventListener("submit", function (e) {
                const isEmailValid = emailValidateChecking();
                const isPasswordValid = passwordValidateChecking();

                if (!isEmailValid || !isPasswordValid) {
                    e.preventDefault();
                    let errorMessage = "";
                    if (!isEmailValid) {
                        errorMessage += error1.innerHTML + "<br>";
                    }
                    if (!isPasswordValid) {
                        errorMessage += error2.innerHTML;
                    }
                }
            });
        });