import bcrypt from 'bcrypt'
import "dotenv/config";

const rounds = Number(process.env.BCRYPT_ROUNDS)

export interface userInterface {
    id: number
    username: string,
    email: string,
    password: string
}

export class User{
    private static users: userInterface[] = []
    private static sequence: number = 1

    id: number;
    username: string;
    email: string;
    password: string;

    constructor(userAttributes: userInterface){
        this.id = userAttributes.id
        this.username = userAttributes.username
        this.email = userAttributes.email
        this.password = userAttributes.password
    }

    static findAll(): userInterface[] {
        return [...this.users]
    }

    static findByEmail(email: string): userInterface | null {
        return this.users.find(user => user.email === email) ?? null;
    }

    static findByID(id: number): userInterface | null {
        return this.users.find(user => user.id === id) ?? null;
    }

    static create(attributes: Partial<userInterface>): User{
        const { username, email, password } = attributes;
        const encryptedPassword = bcrypt.hashSync(password, rounds)
        const newUser = new User({
            id:this.sequence++,
            username,
            email,
            password: encryptedPassword
        })

        this.users.push(newUser)
        return {...newUser, password:null}
    }
}
