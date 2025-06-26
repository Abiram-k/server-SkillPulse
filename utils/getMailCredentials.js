


exports.getPassResetMailCred = (email,name, otp) => {
    const mailCredentials = {

        from: "abiramk0107@gmail.com",
        to: email,
        subject: 'Skill Pulse - OTP for Password Reset',
        text: `Dear ${name},
    
                 Thank you for reaching out to reset your password. Your One-Time Password (OTP) for completing the password reset process is: ${otp}
    
                 Please enter this OTP on the password reset page to proceed with resetting your account password. Note that this OTP is valid only for a limited time, so please use it as soon as possible.
                 If you did not initiate this request, please ignore this email. Your account security is our priority.
    
                 Best regards,  
                 The Skill Pulse Team`
    };
    return mailCredentials;
}
exports.getRegisterMailCred = (email,name, otp) => {
    const mailCredentials = {
        from: "abiramk0107@gmail.com",
        to: email,
        subject: 'SKILL PULSE ,Your OTP for Signup ',
        text: `Dear ${name},

            Thank you for signing up! Your One-Time Password (OTP) for completing your signup process is:One-Time-Password is: ${otp}
            Please enter this OTP on the signup page to verify your account. This OTP is valid for a limited time only, so please use it promptly.
            If you did not initiate this request, please ignore this email. Your account security is important to us.

            Best regards,  
            The [SkillPulse] Team`,

    };
    return mailCredentials;
}

exports.getOrderConfirmMailCred = (email, firstName,orderId,orderDate,orderAmount) => {
    const mailCredentials = {
        from: "abiramk0107@gmail.com",
        to: email,
        subject: 'SKILL PULSE – Order Confirmation',
        text: `Dear ${firstName || "User"},

Thank you for your order with SkillPulse!

We’re excited to inform you that your order has been successfully placed. Below are the details of your order:

Order ID: ${orderId}
Order Date: ${orderDate}
Total Amount: ₹${orderAmount}

You will receive another email once your order is processed and shipped. If you have any questions, feel free to reach out to our support team.

Thank you for choosing SkillPulse. We look forward to serving you again!

Best regards,  
The SkillPulse Team`,
    };

    return mailCredentials;
}

