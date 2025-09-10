import {PrismaClient} from "./generated/prisma";
const prisma = new PrismaClient();

async function main() {
    // //Add a row to the Test table
    // const alice = await prisma.user.create({
    //     data: {first_name: "John", last_name: "Doe", display_email: "abc@def.com", password_hash: "asdkfjaslkefj23rdsklfajsdf"},
    // });

    // const users = await prisma.test.findMany();

    // console.log(users);

}

main().catch((e) => {console.error(e); process.exit(1)})
.finally(async () => {await prisma.$disconnect();});