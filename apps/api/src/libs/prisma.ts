//singleton PrismaClient w/ logging & hooks
import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

export default prisma;