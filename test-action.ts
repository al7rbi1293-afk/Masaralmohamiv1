import { createMatterAction } from './apps/web/app/app/(platform)/matters/actions';

async function testAction() {
    const fd = new FormData();
    fd.append('title', 'Test Matter from script');
    fd.append('status', 'new');
    // client_id purposefully omitted to test the optional handling
    try {
        await createMatterAction(fd);
        console.log("Success");
    } catch (err) {
        console.error("Caught error running action:", err);
    }
}

testAction();
