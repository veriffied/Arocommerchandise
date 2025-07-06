const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const SENDGRID_API_KEY = "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";
const SENDER_EMAIL = "Shuaibuaro@gmail.com";
const REPLY_TO_EMAIL = "Shuaibuaro@gmail.com"; 


const mailTransport = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    auth: {
        user: "apikey",
        pass: SENDGRID_API_KEY,
    },
});

exports.sendApplicationStatusEmail = onDocumentUpdated({
    document: "artifacts/{appId}/all_applications/{applicationId}",
    runtime: "nodejs20",
}, async (event) => {
    console.log("FUNCTION INVOKED: sendApplicationStatusEmail started.");

    const change = event.data;
    const context = event;

    const sendgridApiKey = SENDGRID_API_KEY;
    const senderEmail = SENDER_EMAIL;     
    const replyToEmail = REPLY_TO_EMAIL;     
    console.log("SendGrid config retrieved from hardcoded values (for testing).");
    console.log("Sender Email:", senderEmail);
    console.log("Reply To Email:", replyToEmail);

    const newValue = change.after.data();
    const previousValue = change.before.data();

    const processedByEmail = newValue.processedByEmail || 'N/A';
    const processedByName = newValue.processedByName || 'N/A';
    const processedByPosition = newValue.processedByPosition || 'N/A';
    const processedByRank = newValue.processedByRank || 'N/A';
    const processedBySignature = newValue.processedBySignature || 'N/A';
    const processedTimestamp = newValue.processedTimestamp ?
        new Date(newValue.processedTimestamp.seconds * 1000).toLocaleString() : 'N/A';


    if (newValue.status === previousValue.status ||
        (newValue.status !== "Approved" && newValue.status !== "Denied")) {
        console.log("Status has not changed or is not an actionable status " +
            "(Approved/Denied). No email sent.");
        return null;
    }

    const applicantEmail = newValue.authEmail;
    const applicantName = newValue.name || "Valued Applicant";
    const newStatus = newValue.status;
    const applicationId = context.params.applicationId;

    if (!applicantEmail) {
        console.log(`No email address found for application ${applicationId}. ` +
            `Cannot send email.`);
        return null;
    }

    let subject = "";
    let htmlContent = "";

    const adminDetailsHtml = `
        <div style="background-color: #f9f9f9; border-left: 4px solid #ccc; padding: 15px; margin-top: 20px; border-radius: 8px;">
            <h3 style="color: #333; font-size: 16px; margin-top: 0; margin-bottom: 10px;">Details of Action:</h3>
            <p style="margin: 5px 0; color: #555;"><strong>Processed by:</strong> ${processedByName} (${processedByEmail})</p>
            <p style="margin: 5px 0; color: #555;"><strong>Position:</strong> ${processedByPosition}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Rank:</strong> ${processedByRank}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Signature:</strong> ${processedBySignature}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Date of Action:</strong> ${processedTimestamp}</p>
        </div>
    `;

    if (newStatus === "Approved") {
        subject = "Your AROCOM Application Has Been Approved!";
        htmlContent = `
            <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #fff;">
                <h2 style="color: #28a745; text-align: center; margin-bottom: 20px;">Application Approved!</h2>
                <p>Dear ${applicantName},</p>
                <p>We are thrilled to inform you that your application (ID: 
                <strong style="color: #007bff;">${applicationId}</strong>) for the AROCOM Global Merchandise 
                Limited Asset Acquisition Scheme has been <strong style="color: #28a745;">APPROVED</strong>!</p>
                <p>Our team will be in touch shortly to discuss the next steps and 
                arrange for the delivery of your requested asset(s).</p>
                <p>Thank you for choosing AROCOM.</p>
                <p>Sincerely,</p>
                <p>The AROCOM Team</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                ${adminDetailsHtml}
                <p style="font-size: 12px; color: #777; text-align: center; margin-top: 30px;">
                    This is an automated email. Please do not reply directly to this message.
                </p>
            </div>
          `;
    } else if (newStatus === "Denied") {
        subject = "Update Regarding Your AROCOM Application";
        htmlContent = `
            <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #fff;">
                <h2 style="color: #dc3545; text-align: center; margin-bottom: 20px;">Application Update</h2>
                <p>Dear ${applicantName},</p>
                <p>We regret to inform you that your application (ID: 
                <strong style="color: #007bff;">${applicationId}</strong>) for the AROCOM Global Merchandise 
                Limited Asset Acquisition Scheme has been <strong style="color: #dc3545;">DENIED</strong> at 
                this time.</p>
                <p>We understand this may be disappointing. Please feel free to 
                contact us if you have any questions or would like to discuss your 
                application further.</p>
                <p>Thank you for your interest in AROCOM.</p>
                <p>Sincerely,</p>
                <p>The AROCOM Team</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                ${adminDetailsHtml}
                <p style="font-size: 12px; color: #777; text-align: center; margin-top: 30px;">
                    This is an automated email. Please do not reply directly to this message.
                </p>
            </div>
          `;
    }

    const mailOptions = {
        from: senderEmail,
        to: applicantEmail,
        subject: subject,
        html: htmlContent,
        replyTo: replyToEmail || senderEmail,
    };

    try {
        console.log(`Attempting to send email to ${applicantEmail} ` +
            `for application ${applicationId} with status ${newStatus}.`);
        await mailTransport.sendMail(mailOptions);
        console.log(`Email sent successfully to ${applicantEmail} for ` +
            `application ${applicationId} with status ${newStatus}.`);
        return { success: true };
    } catch (error) {
        console.error(`Error sending email to ${applicantEmail} for ` +
            `application ${applicationId}:`, error);
        if (error.response) {
            console.error("SendGrid API response (body):", error.response.body);
            console.error("SendGrid API response (headers):", error.response.headers);
        }
        return { error: error.message };
    }
});
