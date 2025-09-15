export interface ILogin {
    email: string;
    password : string
}

export interface IResetPassword {
    uid : string,
    token : string,
    new_password : string,
    re_new_password : string
}