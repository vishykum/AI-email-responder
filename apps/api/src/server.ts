//creates HTTP server and starts listening
import {buildApp} from "./app";

const app = buildApp();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
})