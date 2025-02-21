const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');

async function transferOwnership() {
  try {
    console.log('Starting transfer ownership process...');

    // Authenticate using OAuth 2.0 credentials
    const auth = await authenticate({
      keyfilePath: path.join(__dirname, 'credentials.json'), // path to your credentials file
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Search for the file in the 'test' folder
    const folderName = 'test';
    const fileName = 'sample.js';

    // Find the folder ID by querying its name
    const folderRes = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name)',
    });

    if (folderRes.data.files.length === 0) {
      throw new Error(`Folder "${folderName}" not found`);
    }

    const folderId = folderRes.data.files[0].id;

    // Find the file by querying its name within the specified folder
    const fileRes = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents`,
      fields: 'files(id, name, owners)',
    });

    if (fileRes.data.files.length === 0) {
      throw new Error(`File "${fileName}" not found in folder "${folderName}"`);
    }

    const fileId = fileRes.data.files[0].id;
    console.log(`File "${fileName}" found with ID: ${fileId}`);

    // Check if the current owner is 'reydencagata@gmail.com'
    const currentOwnerEmail = 'reydencagata@gmail.com';
    const owners = fileRes.data.files[0].owners;
    const currentOwner = owners.find(owner => owner.emailAddress === currentOwnerEmail);

    if (currentOwner) {
      console.log(`Checking if ${currentOwnerEmail} exists in file permissions...`);
    } else {
      console.log(`${currentOwnerEmail} is not the current owner of the file.`);
      return;
    }

    // Add the new owner (email) to the file
    const newOwnerEmail = 'tmq.shecaynahflores@gmail.com';
    console.log(`Transferring ownership to: ${newOwnerEmail}`);

    // List current permissions to check if new owner already has access
    const res1 = await drive.permissions.list({
      fileId: fileId,
      supportsAllDrives: true,
      pageSize: 100,
      fields: "*",
    });

    // Find permission ID for the new owner
    let permissionId = '';
    const permission = res1.data.permissions.find(
      ({ emailAddress }) => emailAddress === newOwnerEmail
    );

    // If permission exists, use its ID, otherwise create it
    if (permission) {
      permissionId = permission.id;
    } else {
      const { data: { id } } = await drive.permissions.create({
        fileId: fileId,
        sendNotificationEmail: true,
        supportsAllDrives: true,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: newOwnerEmail,
        },
      });
      permissionId = id;
      console.log(`Writer permission granted to: ${newOwnerEmail} with permission ID: ${permissionId}`);
    }

    // Update permission to set the new owner as "pending owner"
    const res2 = await drive.permissions.update({
      fileId: fileId,
      permissionId: permissionId,
      supportsAllDrives: true,
      requestBody: {
        role: 'writer',
        pendingOwner: true, // Setting "pendingOwner"
      },
    });

    console.log('Ownership transfer initiated.');
    console.log(res2.data); // Outputs the updated permission info

  } catch (error) {
    console.error('Error during ownership transfer:', error.message);
  }
}

transferOwnership();
