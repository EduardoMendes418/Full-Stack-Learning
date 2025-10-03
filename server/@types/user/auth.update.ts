export interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

export interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export interface IUpdateProfilePicture {
  avatar: string;
}