import { requestBackendGraphQL } from "./backendGraphqlClient";

export interface UserProfile {
  userId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  passportNumber?: string;
  passportNumberMasked?: string;
  passportCountry?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  preferredLanguage?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type UserDataExport = {
  userId: string;
  exportedAt: string;
  payloadJson: string;
};

type MyProfileGraphQL = {
  myProfile: UserProfile;
};

type UpsertMyProfileGraphQL = {
  upsertMyProfile: UserProfile;
};

type ExportMyDataGraphQL = {
  exportMyData: UserDataExport;
};

type DeleteMyDataGraphQL = {
  deleteMyData: boolean;
};

export const userProfileService = {
  async getMyProfile(): Promise<UserProfile> {
    const data = await requestBackendGraphQL<MyProfileGraphQL>({
      query: `
        query MyProfile {
          myProfile {
            userId
            fullName
            email
            phone
            passportNumber
            passportNumberMasked
            passportCountry
            emergencyContactName
            emergencyContactPhone
            preferredLanguage
            notes
            createdAt
            updatedAt
          }
        }
      `,
    });

    return data.myProfile;
  },

  async upsertMyProfile(input: {
    fullName?: string;
    email?: string;
    phone?: string;
    passportNumber?: string;
    passportCountry?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    preferredLanguage?: string;
    notes?: string;
  }): Promise<UserProfile> {
    const data = await requestBackendGraphQL<UpsertMyProfileGraphQL>({
      query: `
        mutation UpsertMyProfile($input: UpsertUserProfileInput!) {
          upsertMyProfile(input: $input) {
            userId
            fullName
            email
            phone
            passportNumber
            passportNumberMasked
            passportCountry
            emergencyContactName
            emergencyContactPhone
            preferredLanguage
            notes
            createdAt
            updatedAt
          }
        }
      `,
      variables: {
        input,
      },
    });

    return data.upsertMyProfile;
  },

  async exportMyData(): Promise<UserDataExport> {
    const data = await requestBackendGraphQL<ExportMyDataGraphQL>({
      query: `
        query ExportMyData {
          exportMyData {
            userId
            exportedAt
            payloadJson
          }
        }
      `,
    });

    return data.exportMyData;
  },

  async deleteMyData(): Promise<boolean> {
    const data = await requestBackendGraphQL<DeleteMyDataGraphQL>({
      query: `
        mutation DeleteMyData {
          deleteMyData
        }
      `,
    });

    return data.deleteMyData;
  },
};
