import {Router} from "express";
import prisma from "../libs/prisma";
import passport from "passport";
import { checkNotAuthenticated } from "../middlewares/auth.middleware";
import type { Request, Response } from "express";
import { cmdLogger } from "../utils/logger";
import bcrypt from 'bcrypt';

const router: Router = Router();

function validEmail(email: string) {
    //TODO
    return true;
}

function passwordSecure(password: string) {
    //TODO
    return true;
}

//POST /api/register/signup
router.post('/signup',
    checkNotAuthenticated,
    async (req: Request, res: Response) => {
        cmdLogger.info("Inside POST /api/register/signup");
        const formData = req.body;

        if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
            cmdLogger.warn("Form data format incorrect");
            return res.status(400).json({message: "Bad Request"});
        }

        if (!validEmail(formData.email)) {
            cmdLogger.warn("Email provided is not valid");
            return res.status(400).json({message: "Invalid email"});
        }

        if (!passwordSecure(formData.password)) {
            cmdLogger.warn("Insecure password");
            return res.status(400).json({message: "Insecure password"});
        }

        const firstName: string = formData.first_name;
        const lastName: string = formData.last_name;

        if (firstName.length === 0 || lastName.length === 0) {
            cmdLogger.warn("User must provide both first and last names");
            return res.status(400).json({message: "First name or last name missing"});
        }


        try {
            const hashedPass = await bcrypt.hash(formData.password, 10);

            try {
                const insertUser = await prisma.user.create({
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        display_email: formData.email,
                        password_hash: hashedPass
                    }
                });
                
                cmdLogger.info("User created successfully");
                res.status(201).json({ message: "User registered successfully" });
            } catch (err) {
                cmdLogger.error(`Error creating user (ERR: ${JSON.stringify(err)})`);
                res.status(500).json({ message: "Internal server error" });
            }  
        } catch (err) {
            cmdLogger.error("Error hashing password:", err);
            res.status(400).json({message: `Error hashing password(ERR: ${JSON.stringify(err)})`});
        }
    }
);

export default router;