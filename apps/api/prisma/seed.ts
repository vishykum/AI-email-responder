//Imports
import {PrismaClient} from "../generated/prisma";
import usersJSON from "./fixtures/users.json";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

//User Info
const userInfo: ClientUser[] = usersJSON;

//Define main
async function main() {
    //Insert all users in fixtures/users.json into users table

    //Hash user passwords and insert to db
    const insertUsers = await Promise.all(
        userInfo.map(async (u: ClientUser) => {
            const hashedPass = await bcrypt.hash(u.password, 10);
            const {password, ...OtherInfo} = u;

            const HashedUser: DBUser = {
                ...OtherInfo,
                password_hash: hashedPass
            } as DBUser;

            console.log(HashedUser);

            return await prisma.user.create({data: HashedUser});
        })
    );

    console.log("Inserted seed users...");
}


//Call main
main().catch((e) => {console.error(e); process.exit(1)})
.finally(async() => {
    await prisma.$disconnect();
    console.log("Disconnected from db...");
})