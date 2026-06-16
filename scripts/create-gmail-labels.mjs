import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

const prisma = new PrismaClient();

const LABELS = [
  'upwork-alerts-humayun',
  'upwork-alerts-faizan',
  'upwork-alerts-muhammad-s',
  'upwork-alerts-nidal',
  'upwork-alerts-hadiqa',
];

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

async function main() {
  const connection = await prisma.integrationConnection.findFirst({
    where: { provider: 'GOOGLE_GMAIL' },
  });

  if (!connection?.refreshToken && !connection?.accessToken) {
    throw new Error('No Gmail connection found in database. Connect Gmail first via Settings.');
  }

  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  auth.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiryDate?.getTime(),
  });

  const gmail = google.gmail({ version: 'v1', auth });

  const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
  const existingByName = new Map(
    (labelsResponse.data.labels ?? []).map((l) => [l.name ?? '', l.id ?? ''])
  );

  console.log('\nExisting upwork-related labels:');
  for (const [name] of existingByName) {
    if (name.toLowerCase().includes('upwork')) console.log('  •', name);
  }
  console.log('');

  for (const label of LABELS) {
    if (existingByName.has(label)) {
      console.log(`✓ Already exists: ${label}`);
      continue;
    }

    const created = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: label,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
    console.log(`✓ Created: ${label} (id: ${created.data.id})`);
  }

  console.log('\nDone. All labels are ready.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
