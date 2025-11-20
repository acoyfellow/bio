import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateRegistrationOptionsOpts,
  VerifyRegistrationResponseOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { base64urlToBytes, bytesToBase64url, base64ToBytes, bytesToBase64 } from "./utils";

const RP_NAME = "Bio-Authed Edge Agent";

export async function startRegistration(username: string, userId: string, rpId: string) {
  // Convert userId string to Uint8Array
  const userID = new TextEncoder().encode(userId) as unknown as Uint8Array<ArrayBuffer>;

  const opts: GenerateRegistrationOptionsOpts = {
    rpName: RP_NAME,
    rpID: rpId,
    userID: userID,
    userName: username,
    timeout: 60000,
    attestationType: "none",
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      userVerification: "preferred",
      residentKey: "preferred",
    },
  };

  return await generateRegistrationOptions(opts);
}

export async function finishRegistration(
  body: any,
  expectedChallenge: string,
  expectedUserId: string,
  origin: string,
  rpId: string
) {
  const opts: VerifyRegistrationResponseOpts = {
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: true,
  };

  const verification = await verifyRegistrationResponse(opts);
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const regInfo = verification.registrationInfo;
  if (!regInfo.credential) {
    throw new Error("Missing credential in registration info");
  }

  const credentialID = regInfo.credential.id;
  const credentialPublicKey = regInfo.credential.publicKey;

  return {
    credentialID: typeof credentialID === 'string' ? credentialID : bytesToBase64url(credentialID),
    publicKey: bytesToBase64(credentialPublicKey),
    counter: 0,
  };
}

export async function startAuthentication(credentials: Array<{ id: string; transports?: AuthenticatorTransportFuture[] }>, rpId: string) {
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: rpId,
    timeout: 60000,
    allowCredentials: credentials.map((cred) => ({
      id: cred.id,
      transports: cred.transports,
    })),
    userVerification: "preferred",
  };

  return await generateAuthenticationOptions(opts);
}

export async function finishAuthentication(
  body: any,
  expectedChallenge: string,
  credential: { id: string; publicKey: string; counter: number },
  origin: string,
  rpId: string
) {
  const opts: VerifyAuthenticationResponseOpts = {
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    credential: {
      id: credential.id,
      publicKey: base64ToBytes(credential.publicKey) as Uint8Array<ArrayBuffer>,
      counter: credential.counter,
    },
    requireUserVerification: true,
  };

  const verification = await verifyAuthenticationResponse(opts);
  if (!verification.verified) {
    throw new Error("Authentication verification failed");
  }

  return {
    newCounter: verification.authenticationInfo.newCounter,
  };
}

